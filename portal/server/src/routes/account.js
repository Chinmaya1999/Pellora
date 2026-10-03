import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User, ApiKey, UsageLog } from "../models/index.js";
import { setSession, clearSession, requireAuth, generateKey } from "../middleware/auth.js";
import { effectivePlan } from "../plans.js";
import { usedNow, nextDayReset, nextMonthReset, dailySeries } from "../usage.js";
import { CREDIT_COST } from "../plans.js";

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_attempts", message: "Too many attempts. Try again in a few minutes." } });

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// Indian mobile: accepts "98765 43210", "+91 98765-43210" etc. and keeps the 10 digits
const cleanPhone = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const phoneOk = (p) => /^[6-9]\d{9}$/.test(p);

export const publicUser = (u) => {
  const plan = effectivePlan(u);
  return { id: u.id, name: u.name, email: u.email, company: u.company, phone: u.phone, plan: plan.id, planName: plan.name, planExpiresAt: u.planExpiresAt };
};

r.post("/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password, company } = req.body || {};
  const phone = cleanPhone(req.body?.phone);
  if (!name?.trim()) return res.status(400).json({ message: "Please enter your name." });
  if (!emailOk(email || "")) return res.status(400).json({ message: "Please enter a valid email." });
  if (!phoneOk(phone)) return res.status(400).json({ message: "Please enter a valid 10-digit mobile number." });
  if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: "An account with this email already exists." });
  const user = await User.create({ name, email, company, phone, passwordHash: await bcrypt.hash(password, 11) });
  // Starter key so people can try the API right away
  const k = generateKey();
  await ApiKey.create({ user: user._id, name: "Default key", prefix: k.prefix, last4: k.last4, hash: k.hash });
  setSession(res, user._id);
  res.status(201).json({ user: publicUser(user), firstKey: k.key });
});

r.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: (email || "").toLowerCase() });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ message: "Wrong email or password." });
  }
  setSession(res, user._id);
  res.json({ user: publicUser(user) });
});

r.post("/auth/logout", (req, res) => { clearSession(res); res.json({ ok: true }); });
r.get("/auth/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---- usage overview (credits)
const left = (limit, used) => (limit == null ? null : Math.max(0, limit - used));
r.get("/usage", requireAuth, async (req, res) => {
  const plan = effectivePlan(req.user);
  const used = await usedNow(req.user._id);
  res.json({
    plan: plan.id, planName: plan.name, costs: CREDIT_COST,
    day: { used: used.day, limit: plan.dailyCredits, remaining: left(plan.dailyCredits, used.day), resetsAt: nextDayReset() },
    month: { used: used.month, limit: plan.monthlyCredits, remaining: left(plan.monthlyCredits, used.month), resetsAt: nextMonthReset() },
    daily: await dailySeries(req.user._id, 30),
  });
});

// ---- usage history (newest first, cursor = last row's `at`)
r.get("/usage/history", requireAuth, async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const q = { user: req.user._id };
  if (req.query.before) q.at = { $lt: new Date(String(req.query.before)) };
  if (["success", "failed", "rejected"].includes(req.query.status)) q.status = req.query.status;
  if (["api", "playground"].includes(req.query.source)) q.source = req.query.source;
  const rows = await UsageLog.find(q).sort({ at: -1 }).limit(limit + 1);
  const more = rows.length > limit;
  res.json({
    rows: rows.slice(0, limit).map((x) => ({ id: x.id, at: x.at, source: x.source, keyName: x.keyName, status: x.status,
      httpStatus: x.httpStatus, errorCode: x.errorCode, credits: x.credits, ai: x.ai, overlays: x.overlays, ms: x.ms })),
    next: more ? rows[limit - 1].at : null,
  });
});

// ---- API keys
r.get("/keys", requireAuth, async (req, res) => {
  const keys = await ApiKey.find({ user: req.user._id, revoked: false }).sort({ createdAt: -1 });
  res.json({ keys: keys.map((k) => ({ id: k.id, name: k.name, masked: `${k.prefix}…${k.last4}`, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt })) });
});

r.post("/keys", requireAuth, async (req, res) => {
  if ((await ApiKey.countDocuments({ user: req.user._id, revoked: false })) >= 5) {
    return res.status(400).json({ message: "You can have up to 5 active keys. Revoke one first." });
  }
  const k = generateKey();
  const doc = await ApiKey.create({ user: req.user._id, name: (req.body?.name || "New key").slice(0, 60), prefix: k.prefix, last4: k.last4, hash: k.hash });
  res.status(201).json({ id: doc.id, name: doc.name, key: k.key }); // full key is shown only this once
});

r.delete("/keys/:id", requireAuth, async (req, res) => {
  const out = await ApiKey.updateOne({ _id: req.params.id, user: req.user._id }, { revoked: true });
  res.json({ ok: out.modifiedCount === 1 });
});

export default r;
