import { Router } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { config, razorpayEnabled } from "../config.js";
import { PLANS, PLAN_DAYS, publicPlans } from "../plans.js";
import { User, Payment } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
const rzp = razorpayEnabled ? new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret }) : null;

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Idempotent: a payment can only activate a plan once. */
async function fulfil(orderId, paymentId) {
  const pay = await Payment.findOneAndUpdate({ orderId, status: "created" }, { status: "paid", paymentId }, { new: true });
  if (!pay) return false; // already processed (e.g. verify + webhook both arrived)
  const user = await User.findById(pay.user);
  const stillActive = user.plan === pay.plan && user.planExpiresAt && user.planExpiresAt > new Date();
  const from = stillActive ? user.planExpiresAt : new Date();
  user.plan = pay.plan;
  user.planExpiresAt = new Date(from.getTime() + PLAN_DAYS * 86400000);
  await user.save();
  return true;
}

r.get("/plans", (req, res) => res.json({
  plans: publicPlans(), razorpayKeyId: config.razorpayKeyId || null,
  devCheckout: !razorpayEnabled && !config.isProd, brand: config.brand,
}));

r.post("/order", requireAuth, async (req, res) => {
  const plan = PLANS[req.body?.plan];
  if (!plan || !plan.priceInr) return res.status(400).json({ message: "Choose a paid plan." });
  const amountPaise = plan.priceInr * 100;

  if (!rzp) { // development without Razorpay keys
    if (config.isProd) return res.status(503).json({ message: "Payments are not configured." });
    const orderId = `dev_${crypto.randomUUID()}`;
    await Payment.create({ user: req.user._id, plan: plan.id, amountPaise, orderId, mock: true });
    return res.json({ mock: true, orderId, plan: plan.id });
  }
  const order = await rzp.orders.create({
    amount: amountPaise, currency: "INR", receipt: `u${req.user.id.slice(-6)}_${Date.now()}`,
    notes: { userId: req.user.id, plan: plan.id },
  });
  await Payment.create({ user: req.user._id, plan: plan.id, amountPaise, orderId: order.id });
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: config.razorpayKeyId, plan: plan.id, planName: plan.name });
});

// Browser callback after Razorpay checkout
r.post("/verify", requireAuth, async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = req.body || {};
  if (!rzp) return res.status(400).json({ message: "Razorpay not configured." });
  if (!orderId || !paymentId || !sig || !safeEq(hmac(config.razorpayKeySecret, `${orderId}|${paymentId}`), String(sig))) {
    return res.status(400).json({ message: "Payment verification failed." });
  }
  const own = await Payment.exists({ orderId, user: req.user._id });
  if (!own) return res.status(404).json({ message: "Order not found." });
  await fulfil(orderId, paymentId);
  res.json({ ok: true });
});

// Dev only: activate without paying (disabled once Razorpay keys exist or in production)
r.post("/dev-activate", requireAuth, async (req, res) => {
  if (rzp || config.isProd) return res.status(404).json({ message: "Not found." });
  const ok = await Payment.exists({ orderId: req.body?.orderId, user: req.user._id });
  if (!ok) return res.status(404).json({ message: "Order not found." });
  await fulfil(req.body.orderId, `dev_pay_${Date.now()}`);
  res.json({ ok: true });
});

r.get("/history", requireAuth, async (req, res) => {
  const rows = await Payment.find({ user: req.user._id, status: "paid" }).sort({ createdAt: -1 }).limit(50);
  res.json({ payments: rows.map((p) => ({ id: p.id, plan: p.plan, amount: p.amountPaise / 100, paymentId: p.paymentId, date: p.updatedAt, mock: p.mock })) });
});

// Razorpay webhook (set URL to /api/billing/webhook, event: payment.captured). Needs raw body.
export async function webhook(req, res) {
  if (!config.razorpayWebhookSecret) return res.status(404).end();
  const raw = req.body; // Buffer (express.raw)
  const sig = req.get("x-razorpay-signature") || "";
  if (!safeEq(hmac(config.razorpayWebhookSecret, raw), sig)) return res.status(400).end();
  const evt = JSON.parse(raw.toString());
  if (evt.event === "payment.captured") {
    const p = evt.payload.payment.entity;
    await fulfil(p.order_id, p.id);
  }
  res.json({ ok: true });
}

export default r;
