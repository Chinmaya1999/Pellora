import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User, ApiKey } from "../models/index.js";
import { setSession, clearSession, requireAuth, generateKey } from "../middleware/auth.js";
import { effectivePlan } from "../plans.js";
import { usedThisMonth, nextReset, dailySeries } from "../usage.js";

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_attempts", message: "Too many attempts. Try again in a few minutes." } });

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const publicUser = (u) => {
  const plan = effectivePlan(u);
  return { id: u.id, name: u.name, email: u.email, company: u.company, plan: plan.id, planName: plan.name, planExpiresAt: u.planExpiresAt };
};

r.post("/auth/signup", authLimiter, async (req, res) => {
  const { name, email, password, company } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: "Please enter your name." });
  if (!emailOk(email || "")) return res.status(400).json({ message: "Please enter a valid email." });
  if (!password || password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: "An account with this email already exists." });
  const user = await User.create({ name, email, company, passwordHash: await bcrypt.hash(password, 11) });
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

// ---- usage overview
r.get("/usage", requireAuth, async (req, res) => {
  const plan = effectivePlan(req.user);
  const used = await usedThisMonth(req.user._id);
  res.json({
    plan: plan.id, planName: plan.name, limit: plan.scans, used,
    remaining: plan.scans == null ? null : Math.max(0, plan.scans - used),
    resetsAt: nextReset(), daily: await dailySeries(req.user._id, 30),
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
