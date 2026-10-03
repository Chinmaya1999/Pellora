import { Router } from "express";
import crypto from "crypto";
import { config, paymentsEnabled } from "../config.js";
import { getPlan, planDays, publicPlans } from "../plans.js";
import { User, Payment } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

// ---- Cashfree PG (Orders API) ------------------------------------------------
const CF_BASE = config.cashfreeEnv === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

async function cf(path, body) {
  const res = await fetch(`${CF_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "x-client-id": config.cashfreeAppId, "x-client-secret": config.cashfreeSecret,
      "x-api-version": "2025-01-01", "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "Cashfree request failed"), { status: res.status, data });
  return data;
}

const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Idempotent: a paid order can only activate a plan once (verify + webhook may both arrive). */
async function fulfil(orderId, paymentId) {
  const pay = await Payment.findOneAndUpdate({ orderId, status: "created" }, { status: "paid", paymentId }, { new: true });
  if (!pay) return false;
  const user = await User.findById(pay.user);
  const stillActive = user.plan === pay.plan && user.planExpiresAt && user.planExpiresAt > new Date();
  const from = stillActive ? user.planExpiresAt : new Date();
  user.plan = pay.plan;
  user.planExpiresAt = new Date(from.getTime() + planDays() * 86400000);
  await user.save();
  return true;
}

/** Ask Cashfree (source of truth) whether an order is paid, and activate the plan if so. */
export async function settle(orderId) {
  const pay = await Payment.findOne({ orderId });
  if (!pay) return { status: "unknown" };
  if (pay.status === "paid") return { status: "PAID" };
  const order = await cf(`/orders/${encodeURIComponent(orderId)}`);
  if (Math.round(Number(order.order_amount) * 100) !== pay.amountPaise) return { status: "AMOUNT_MISMATCH" };

  // The order flag can lag a few seconds behind the payment, so also accept a captured SUCCESS payment.
  let ok = null;
  try {
    const list = await cf(`/orders/${encodeURIComponent(orderId)}/payments`);
    ok = (Array.isArray(list) ? list : []).find((p) =>
      p.payment_status === "SUCCESS" && Math.round(Number(p.payment_amount) * 100) === pay.amountPaise);
  } catch { /* fall back to the order flag */ }
  if (order.order_status !== "PAID" && !ok) return { status: order.order_status };

  await fulfil(orderId, ok ? String(ok.cf_payment_id) : String(order.cf_order_id || orderId));
  return { status: "PAID" };
}

r.get("/plans", (req, res) => res.json({
  plans: publicPlans(), provider: "cashfree", mode: config.cashfreeEnv,
  devCheckout: !paymentsEnabled && !config.isProd, paymentsEnabled, brand: config.brand,
}));

r.post("/order", requireAuth, async (req, res) => {
  const plan = getPlan(req.body?.plan);
  if (!plan || !plan.active || plan.contact || !plan.priceInr) return res.status(400).json({ message: "Choose a paid plan." });
  const amountPaise = plan.priceInr * 100;

  if (!paymentsEnabled) { // development without Cashfree keys
    if (config.isProd) return res.status(503).json({ message: "Payments are not configured." });
    const orderId = `dev_${crypto.randomUUID()}`;
    await Payment.create({ user: req.user._id, plan: plan.id, amountPaise, orderId, mock: true });
    return res.json({ mock: true, orderId, plan: plan.id });
  }

  const phone = String(req.body?.phone || req.user.phone || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: "Enter a valid 10-digit mobile number for the payment." });
  if (req.user.phone !== phone) { req.user.phone = phone; await req.user.save(); }

  const orderId = `ord_${req.user.id.slice(-8)}_${Date.now()}`;
  const order = await cf("/orders", {
    order_id: orderId, order_amount: plan.priceInr, order_currency: "INR",
    customer_details: { customer_id: `u_${req.user.id}`, customer_name: req.user.name.slice(0, 50), customer_email: req.user.email, customer_phone: phone },
    order_meta: {
      return_url: `${config.publicUrl}/dashboard/billing?order_id={order_id}`,
      ...(config.apiPublicUrl && { notify_url: `${config.apiPublicUrl}/api/billing/webhook` }),
    },
    order_note: `${plan.name} plan - ${planDays()} days`,
  });
  await Payment.create({ user: req.user._id, plan: plan.id, amountPaise, orderId });
  res.json({ orderId, paymentSessionId: order.payment_session_id, mode: config.cashfreeEnv, plan: plan.id, planName: plan.name });
});

// Browser calls this after checkout closes / returns; we confirm with Cashfree ourselves.
r.post("/verify", requireAuth, async (req, res) => {
  const orderId = String(req.body?.orderId || "");
  if (!(await Payment.exists({ orderId, user: req.user._id }))) return res.status(404).json({ message: "Order not found." });
  res.json(await settle(orderId));
});

// Dev only: activate without paying (disabled once Cashfree keys exist or in production)
r.post("/dev-activate", requireAuth, async (req, res) => {
  if (paymentsEnabled || config.isProd) return res.status(404).json({ message: "Not found." });
  const ok = await Payment.exists({ orderId: req.body?.orderId, user: req.user._id });
  if (!ok) return res.status(404).json({ message: "Order not found." });
  await fulfil(req.body.orderId, `dev_pay_${Date.now()}`);
  res.json({ ok: true });
});

r.get("/history", requireAuth, async (req, res) => {
  const rows = await Payment.find({ user: req.user._id, status: "paid" }).sort({ createdAt: -1 }).limit(50);
  res.json({ payments: rows.map((p) => ({ id: p.id, plan: p.plan, amount: p.amountPaise / 100, paymentId: p.paymentId, date: p.updatedAt, mock: p.mock })) });
});

// Cashfree webhook (set in Cashfree dashboard -> Developers -> Webhooks). Needs the raw body.
export async function webhook(req, res) {
  if (!paymentsEnabled) return res.status(404).end();
  const raw = req.body; // Buffer (express.raw)
  const ts = req.get("x-webhook-timestamp") || "";
  const sig = req.get("x-webhook-signature") || "";
  const expect = crypto.createHmac("sha256", config.cashfreeSecret).update(ts + raw.toString()).digest("base64");
  if (!sig || !safeEq(expect, sig)) return res.status(400).end();
  const evt = JSON.parse(raw.toString());
  if (evt.type === "PAYMENT_SUCCESS_WEBHOOK") await settle(evt.data?.order?.order_id);
  res.json({ ok: true });
}

export default r;
