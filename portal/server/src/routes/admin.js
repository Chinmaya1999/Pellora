import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User, ApiKey, Usage, Daily, UsageLog, Payment, Plan, Setting, AdminLog } from "../models/index.js";
import { requireAuth, requireAdmin, generateKey } from "../middleware/auth.js";
import { loadConfig, allPlans, getPlan, getSettings, effectivePlan, publicPlan } from "../plans.js";
import { dayOf, periodOf, dailySeries } from "../usage.js";
import { settle } from "./billing.js";

const r = Router();
r.use(requireAuth, requireAdmin);

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const int = (v, min = 0) => (Number.isFinite(Number(v)) && Number(v) >= min ? Math.floor(Number(v)) : null);
const nullableInt = (v) => (v === null || v === "" || v === undefined ? null : int(v));
const page = (req, max = 100) => {
  const limit = Math.min(max, Math.max(1, Number(req.query.limit) || 25));
  const p = Math.max(1, Number(req.query.page) || 1);
  return { limit, skip: (p - 1) * limit, page: p };
};
const tempPassword = () => crypto.randomBytes(9).toString("base64url");

async function audit(req, action, target, detail) {
  await AdminLog.create({ admin: req.user._id, adminEmail: req.user.email, action, target, detail }).catch(() => {});
}

const userRow = (u, usage = {}, keys = 0) => {
  const eff = effectivePlan(u);
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, company: u.company, role: u.role, disabled: !!u.disabled,
    plan: u.plan, effectivePlan: eff.id, planName: eff.name, planExpiresAt: u.planExpiresAt,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, creditsToday: usage.day || 0, creditsMonth: usage.month || 0, keys,
  };
};

// ------------------------------------------------------------------ overview
r.get("/stats", async (req, res) => {
  const now = new Date(), since = new Date(Date.now() - 29 * 86400000), week = new Date(Date.now() - 7 * 86400000);
  const [users, newWeek, paidNow, revenue, revDaily, scansToday, scansMonth, scansDaily, statuses, planDist, signups] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: week } }),
    User.countDocuments({ plan: { $ne: "free" }, planExpiresAt: { $gt: now } }),
    Payment.aggregate([{ $match: { status: "paid", mock: false } }, { $group: { _id: null, total: { $sum: "$amountPaise" }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: "paid", mock: false, updatedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt", timezone: "+05:30" } }, amount: { $sum: "$amountPaise" } } }]),
    Daily.aggregate([{ $match: { day: dayOf() } }, { $group: { _id: null, c: { $sum: "$count" }, users: { $sum: 1 } } }]),
    Usage.aggregate([{ $match: { period: periodOf() } }, { $group: { _id: null, c: { $sum: "$count" } } }]),
    Daily.aggregate([{ $match: { day: { $gte: dayOf(since) } } }, { $group: { _id: "$day", c: { $sum: "$count" } } }]),
    UsageLog.aggregate([{ $match: { at: { $gte: new Date(Date.now() - 86400000) } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: { $cond: [{ $or: [{ $eq: ["$plan", "free"] }, { $not: ["$planExpiresAt"] }, { $lt: ["$planExpiresAt", now] }] }, "free", "$plan"] }, n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, n: { $sum: 1 } } }]),
  ]);
  const series = (rows, key) => {
    const m = new Map(rows.map((x) => [x._id, x[key]]));
    return Array.from({ length: 30 }, (_, i) => { const day = dayOf(new Date(Date.now() - (29 - i) * 86400000)); return { day, value: m.get(day) || 0 }; });
  };
  res.json({
    users, newUsers7d: newWeek, paidUsers: paidNow,
    revenueTotal: (revenue[0]?.total || 0) / 100, paymentsCount: revenue[0]?.n || 0,
    revenue30d: revDaily.reduce((a, x) => a + x.amount, 0) / 100,
    creditsToday: scansToday[0]?.c || 0, activeToday: scansToday[0]?.users || 0, creditsMonth: scansMonth[0]?.c || 0,
    requests24h: Object.fromEntries(statuses.map((x) => [x._id, x.n])),
    plans: planDist.map((x) => ({ plan: x._id, name: getPlan(x._id)?.name || x._id, n: x.n })),
    creditsDaily: series(scansDaily, "c"), revenueDaily: series(revDaily, "amount").map((d) => ({ ...d, value: d.value / 100 })),
    signupsDaily: series(signups, "n"),
  });
});

// --------------------------------------------------------------------- users
r.get("/users", async (req, res) => {
  const { limit, skip, page: p } = page(req);
  const filter = {}, ands = [], now = new Date();
  if (req.query.q) { const rx = new RegExp(esc(req.query.q), "i"); ands.push({ $or: [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }] }); }
  if (req.query.role === "admin" || req.query.role === "user") filter.role = req.query.role;
  if (req.query.status === "disabled") filter.disabled = true;
  if (req.query.plan === "free") ands.push({ $or: [{ plan: "free" }, { planExpiresAt: null }, { planExpiresAt: { $lt: now } }] });
  else if (req.query.plan) ands.push({ plan: String(req.query.plan), planExpiresAt: { $gt: now } });
  if (ands.length) filter.$and = ands;

  const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  const ids = rows.map((u) => u._id);
  const [d, m, k] = await Promise.all([
    Daily.find({ user: { $in: ids }, day: dayOf() }), Usage.find({ user: { $in: ids }, period: periodOf() }),
    ApiKey.aggregate([{ $match: { user: { $in: ids }, revoked: false } }, { $group: { _id: "$user", n: { $sum: 1 } } }]),
  ]);
  const dm = new Map(d.map((x) => [String(x.user), x.count])), mm = new Map(m.map((x) => [String(x.user), x.count])), km = new Map(k.map((x) => [String(x._id), x.n]));
  res.json({ total, page: p, limit, users: rows.map((u) => userRow(u, { day: dm.get(u.id), month: mm.get(u.id) }, km.get(u.id) || 0)) });
});

r.get("/users/:id", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  const [keys, logs, payments, day, month, series] = await Promise.all([
    ApiKey.find({ user: u._id }).sort({ createdAt: -1 }),
    UsageLog.find({ user: u._id }).sort({ at: -1 }).limit(15),
    Payment.find({ user: u._id }).sort({ createdAt: -1 }).limit(20),
    Daily.findOne({ user: u._id, day: dayOf() }), Usage.findOne({ user: u._id, period: periodOf() }), dailySeries(u._id, 30),
  ]);
  res.json({
    user: userRow(u, { day: day?.count, month: month?.count }, keys.filter((k) => !k.revoked).length),
    keys: keys.map((k) => ({ id: k.id, name: k.name, masked: `${k.prefix}…${k.last4}`, revoked: k.revoked, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })),
    logs: logs.map((x) => ({ id: x.id, at: x.at, source: x.source, keyName: x.keyName, status: x.status, httpStatus: x.httpStatus, errorCode: x.errorCode, credits: x.credits })),
    payments: payments.map((p) => ({ id: p.id, orderId: p.orderId, plan: p.plan, amount: p.amountPaise / 100, status: p.status, manual: p.manual, mock: p.mock, paymentId: p.paymentId, note: p.note, at: p.updatedAt })),
    daily: series,
  });
});

r.post("/users", async (req, res) => {
  const { name, email, phone, company, role, plan, days } = req.body || {};
  if (!name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return res.status(400).json({ message: "Name and a valid email are required." });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: "An account with this email already exists." });
  const password = req.body.password || tempPassword();
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  const planId = plan && getPlan(plan) ? plan : "free";
  const u = await User.create({
    name, email, phone: String(phone || "").replace(/\D/g, "").slice(-10), company, role: role === "admin" ? "admin" : "user",
    passwordHash: await bcrypt.hash(password, 11), plan: planId,
    planExpiresAt: planId === "free" ? null : new Date(Date.now() + (int(days, 1) || 30) * 86400000),
  });
  const k = generateKey();
  await ApiKey.create({ user: u._id, name: "Default key", prefix: k.prefix, last4: k.last4, hash: k.hash });
  await audit(req, "user.create", u.email, { plan: planId, role: u.role });
  res.status(201).json({ id: u.id, email: u.email, password, apiKey: k.key });
});

r.patch("/users/:id", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  const b = req.body || {}, before = { plan: u.plan, planExpiresAt: u.planExpiresAt, role: u.role, disabled: u.disabled };
  const self = u.id === req.user.id;

  if (b.name !== undefined) u.name = String(b.name).trim().slice(0, 80) || u.name;
  if (b.company !== undefined) u.company = String(b.company).slice(0, 120);
  if (b.phone !== undefined) u.phone = String(b.phone).replace(/\D/g, "").slice(-10);
  if (b.email !== undefined && b.email.toLowerCase() !== u.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res.status(400).json({ message: "Invalid email." });
    if (await User.exists({ email: b.email.toLowerCase(), _id: { $ne: u._id } })) return res.status(409).json({ message: "That email is already used." });
    u.email = b.email.toLowerCase();
  }
  if (b.role !== undefined) {
    if (self && b.role !== "admin") return res.status(400).json({ message: "You can't remove your own admin role." });
    u.role = b.role === "admin" ? "admin" : "user";
  }
  if (b.disabled !== undefined) {
    if (self && b.disabled) return res.status(400).json({ message: "You can't disable your own account." });
    u.disabled = !!b.disabled;
  }
  if (b.plan !== undefined) {
    if (!getPlan(b.plan)) return res.status(400).json({ message: "Unknown plan." });
    u.plan = b.plan;
    if (b.plan === "free") u.planExpiresAt = null;
    else if (b.planExpiresAt) u.planExpiresAt = new Date(b.planExpiresAt);
    else if (b.days) u.planExpiresAt = new Date(Date.now() + int(b.days, 1) * 86400000);
    else if (!u.planExpiresAt || u.planExpiresAt < new Date()) u.planExpiresAt = new Date(Date.now() + 30 * 86400000);
  } else if (b.planExpiresAt !== undefined && u.plan !== "free") u.planExpiresAt = b.planExpiresAt ? new Date(b.planExpiresAt) : null;
  if (u.planExpiresAt && isNaN(u.planExpiresAt)) return res.status(400).json({ message: "Invalid expiry date." });
  await u.save();

  // optional: record that the customer paid outside the gateway (UPI / bank transfer / cash)
  if (b.recordPayment && Number(b.recordPayment.amount) > 0 && u.plan !== "free") {
    await Payment.create({ user: u._id, plan: u.plan, amountPaise: Math.round(Number(b.recordPayment.amount) * 100), status: "paid",
      orderId: `manual_${crypto.randomUUID()}`, paymentId: "manual", manual: true, note: String(b.recordPayment.note || "").slice(0, 200) });
  }
  await audit(req, "user.update", u.email, { before, after: { plan: u.plan, planExpiresAt: u.planExpiresAt, role: u.role, disabled: u.disabled }, payment: !!b.recordPayment });
  res.json({ ok: true });
});

r.post("/users/:id/reset-password", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  const password = req.body?.password || tempPassword();
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  u.passwordHash = await bcrypt.hash(password, 11); await u.save();
  await audit(req, "user.reset_password", u.email);
  res.json({ password });
});

r.delete("/users/:id", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  if (u.id === req.user.id) return res.status(400).json({ message: "You can't delete your own account." });
  await Promise.all([ApiKey, Usage, Daily, UsageLog, Payment].map((M) => M.deleteMany({ user: u._id })));
  await u.deleteOne();
  await audit(req, "user.delete", u.email);
  res.json({ ok: true });
});

// ------------------------------------------------------------------ API keys
r.get("/keys", async (req, res) => {
  const { limit, skip, page: p } = page(req);
  const filter = {};
  if (req.query.state === "active") filter.revoked = false;
  if (req.query.state === "revoked") filter.revoked = true;
  if (req.query.q) {
    const rx = new RegExp(esc(req.query.q), "i");
    const ids = await User.find({ $or: [{ email: rx }, { name: rx }] }).distinct("_id");
    filter.$or = [{ user: { $in: ids } }, { name: rx }];
  }
  const [rows, total] = await Promise.all([ApiKey.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "email name"), ApiKey.countDocuments(filter)]);
  res.json({ total, page: p, limit, keys: rows.map((k) => ({ id: k.id, name: k.name, masked: `${k.prefix}…${k.last4}`, revoked: k.revoked,
    createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, userId: k.user?.id, userEmail: k.user?.email, userName: k.user?.name })) });
});

r.post("/users/:id/keys", async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found." });
  const k = generateKey();
  const doc = await ApiKey.create({ user: u._id, name: String(req.body?.name || "Admin-issued key").slice(0, 60), prefix: k.prefix, last4: k.last4, hash: k.hash });
  await audit(req, "key.create", u.email, { name: doc.name });
  res.status(201).json({ id: doc.id, name: doc.name, key: k.key }); // shown once
});

r.patch("/keys/:id", async (req, res) => {
  const k = await ApiKey.findByIdAndUpdate(req.params.id, { revoked: !!req.body?.revoked }, { new: true }).populate("user", "email");
  if (!k) return res.status(404).json({ message: "Key not found." });
  await audit(req, k.revoked ? "key.revoke" : "key.restore", k.user?.email, { name: k.name });
  res.json({ ok: true });
});

// --------------------------------------------------------------------- plans
r.get("/plans", async (req, res) => {
  const counts = await User.aggregate([{ $group: { _id: "$plan", n: { $sum: 1 } } }]);
  const cm = new Map(counts.map((x) => [x._id, x.n]));
  res.json({ plans: allPlans().map((p) => ({ ...publicPlan(p), users: cm.get(p.id) || 0 })), settings: getSettings() });
});

function planFields(b, creating) {
  const f = {};
  if (b.name !== undefined) f.name = String(b.name).trim().slice(0, 40);
  if (b.blurb !== undefined) f.blurb = String(b.blurb).slice(0, 160);
  if (b.priceInr !== undefined) f.priceInr = nullableInt(b.priceInr);
  if (b.dailyCredits !== undefined) f.dailyCredits = nullableInt(b.dailyCredits);
  if (b.monthlyCredits !== undefined) f.monthlyCredits = nullableInt(b.monthlyCredits);
  if (b.rpm !== undefined) f.rpm = int(b.rpm, 1) ?? 10;
  for (const k of ["ai", "popular", "contact", "active"]) if (b[k] !== undefined) f[k] = !!b[k];
  if (b.order !== undefined) f.order = int(b.order) ?? 100;
  if (b.extraFeatures !== undefined) f.extraFeatures = (Array.isArray(b.extraFeatures) ? b.extraFeatures : String(b.extraFeatures).split("\n")).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
  if (creating && !f.name) throw Object.assign(new Error("Plan name is required."), { status: 400 });
  return f;
}

r.post("/plans", async (req, res) => {
  const id = String(req.body?.id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  if (!id) return res.status(400).json({ message: "Plan id (letters/numbers) is required." });
  if (getPlan(id)) return res.status(409).json({ message: "A plan with this id already exists." });
  await Plan.create({ id, ...planFields(req.body, true) });
  await loadConfig(); await audit(req, "plan.create", id, req.body);
  res.status(201).json({ ok: true });
});

r.patch("/plans/:id", async (req, res) => {
  const p = await Plan.findOne({ id: req.params.id });
  if (!p) return res.status(404).json({ message: "Plan not found." });
  const before = p.toObject(), f = planFields(req.body || {}, false);
  if (p.id === "free") { f.active = true; f.contact = false; f.priceInr = 0; } // the free tier always exists
  Object.assign(p, f); await p.save();
  await loadConfig(); await audit(req, "plan.update", p.id, { before: { priceInr: before.priceInr, dailyCredits: before.dailyCredits, monthlyCredits: before.monthlyCredits, rpm: before.rpm, ai: before.ai, active: before.active }, after: f });
  res.json({ ok: true });
});

r.delete("/plans/:id", async (req, res) => {
  if (req.params.id === "free") return res.status(400).json({ message: "The Free plan can't be deleted." });
  if (await User.exists({ plan: req.params.id })) return res.status(400).json({ message: "Users are on this plan. Hide it instead (turn off Active), or move them first." });
  await Plan.deleteOne({ id: req.params.id }); await loadConfig(); await audit(req, "plan.delete", req.params.id);
  res.json({ ok: true });
});

// ------------------------------------------------------------------ settings
r.put("/settings", async (req, res) => {
  const b = req.body || {}, cur = getSettings();
  const next = {
    creditCost: { scan: int(b.creditCost?.scan, 0) ?? cur.creditCost.scan, ai: int(b.creditCost?.ai, 0) ?? cur.creditCost.ai },
    planDays: Math.min(366, int(b.planDays, 1) ?? cur.planDays),
  };
  await Setting.updateOne({ key: "global" }, { value: next }, { upsert: true });
  await loadConfig(); await audit(req, "settings.update", "global", { before: cur, after: next });
  res.json({ settings: getSettings() });
});

// ------------------------------------------------------------------ payments
r.get("/payments", async (req, res) => {
  const { limit, skip, page: p } = page(req);
  const filter = {};
  if (["paid", "created"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(esc(req.query.q), "i");
    const ids = await User.find({ $or: [{ email: rx }, { name: rx }] }).distinct("_id");
    filter.$or = [{ user: { $in: ids } }, { orderId: rx }, { paymentId: rx }];
  }
  const [rows, total] = await Promise.all([Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "email name"), Payment.countDocuments(filter)]);
  res.json({ total, page: p, limit, payments: rows.map((x) => ({ id: x.id, orderId: x.orderId, plan: x.plan, amount: x.amountPaise / 100, status: x.status,
    mock: x.mock, manual: x.manual, paymentId: x.paymentId, note: x.note, createdAt: x.createdAt, paidAt: x.status === "paid" ? x.updatedAt : null,
    userId: x.user?.id, userEmail: x.user?.email, userName: x.user?.name })) });
});

// Re-ask Cashfree about an unpaid order (e.g. the customer paid but closed the tab and the webhook never arrived)
r.post("/payments/:id/recheck", async (req, res) => {
  const pay = await Payment.findById(req.params.id);
  if (!pay) return res.status(404).json({ message: "Payment not found." });
  if (pay.manual || pay.mock) return res.status(400).json({ message: "This payment wasn't made through the gateway." });
  const out = await settle(pay.orderId);
  await audit(req, "payment.recheck", pay.orderId, out);
  res.json(out);
});

// --------------------------------------------------------------- usage + audit
r.get("/usage-logs", async (req, res) => {
  const { limit, skip, page: p } = page(req);
  const filter = {};
  if (["success", "failed", "rejected"].includes(req.query.status)) filter.status = req.query.status;
  if (["api", "playground"].includes(req.query.source)) filter.source = req.query.source;
  if (req.query.q) {
    const rx = new RegExp(esc(req.query.q), "i");
    filter.user = { $in: await User.find({ $or: [{ email: rx }, { name: rx }] }).distinct("_id") };
  }
  const [rows, total] = await Promise.all([UsageLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit).populate("user", "email"), UsageLog.countDocuments(filter)]);
  res.json({ total, page: p, limit, logs: rows.map((x) => ({ id: x.id, at: x.at, userEmail: x.user?.email, source: x.source, keyName: x.keyName, status: x.status,
    httpStatus: x.httpStatus, errorCode: x.errorCode, credits: x.credits, ai: x.ai, overlays: x.overlays, ms: x.ms })) });
});

r.get("/audit", async (req, res) => {
  const { limit, skip, page: p } = page(req);
  const [rows, total] = await Promise.all([AdminLog.find().sort({ at: -1 }).skip(skip).limit(limit), AdminLog.countDocuments()]);
  res.json({ total, page: p, limit, logs: rows.map((x) => ({ id: x.id, at: x.at, admin: x.adminEmail, action: x.action, target: x.target, detail: x.detail })) });
});

export default r;
