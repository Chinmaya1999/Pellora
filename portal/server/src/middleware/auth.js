import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config.js";
import { User, ApiKey } from "../models/index.js";
import { effectivePlan } from "../plans.js";

const COOKIE = "sid";
const WEEK = 7 * 24 * 3600 * 1000;

export function setSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: "7d" });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: config.isProd, maxAge: WEEK });
}
export const clearSession = (res) => res.clearCookie(COOKIE);

/** Dashboard login (cookie session). */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: "unauthenticated", message: "Please log in." });
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ error: "unauthenticated", message: "Please log in." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "unauthenticated", message: "Please log in." });
  }
}

export const hashKey = (k) => crypto.createHash("sha256").update(k).digest("hex");

export function generateKey() {
  const secret = crypto.randomBytes(24).toString("hex");
  const key = `sk_live_${secret}`;
  return { key, prefix: key.slice(0, 12), last4: key.slice(-4), hash: hashKey(key) };
}

// Simple per-key sliding-minute rate limiter (single-process; use Redis if you scale out).
const windows = new Map();
function rateLimited(id, rpm) {
  const now = Date.now();
  const w = (windows.get(id) || []).filter((t) => now - t < 60_000);
  if (w.length >= rpm) { windows.set(id, w); return true; }
  w.push(now); windows.set(id, w);
  return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of windows) if (!v.some((t) => now - t < 60_000)) windows.delete(k); }, 60_000).unref();

export const checkRate = rateLimited;

/** Customer API calls: X-API-Key header (or Authorization: Bearer). */
export async function requireApiKey(req, res, next) {
  try {
    const raw = req.get("x-api-key") || (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!raw) return res.status(401).json({ error: "missing_api_key", message: "Send your key in the X-API-Key header." });
    const key = await ApiKey.findOne({ hash: hashKey(raw.trim()), revoked: false });
    if (!key) return res.status(401).json({ error: "invalid_api_key", message: "Invalid or revoked API key." });
    const user = await User.findById(key.user);
    if (!user) return res.status(401).json({ error: "invalid_api_key", message: "Invalid or revoked API key." });
    const plan = effectivePlan(user);
    if (rateLimited(`k:${key.id}`, plan.rpm)) {
      res.set("Retry-After", "10");
      return res.status(429).json({ error: "rate_limited", message: `Rate limit is ${plan.rpm} requests/minute on the ${plan.name} plan.` });
    }
    ApiKey.updateOne({ _id: key._id }, { lastUsedAt: new Date() }).catch(() => {});
    req.user = user; req.plan = plan; req.keyName = key.name;
    next();
  } catch (e) { next(e); }
}
