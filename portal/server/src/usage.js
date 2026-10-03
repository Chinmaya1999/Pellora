import { Usage, Daily } from "./models/index.js";

export const periodOf = (d = new Date()) => d.toISOString().slice(0, 7);
export const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);

export function nextReset(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export async function usedThisMonth(userId) {
  const u = await Usage.findOne({ user: userId, period: periodOf() });
  return u?.count || 0;
}

/**
 * Atomically take one scan from the monthly quota.
 * Returns the new count, or null when the quota is exhausted.
 */
export async function consume(userId, limit) {
  const period = periodOf();
  await Usage.updateOne({ user: userId, period }, { $setOnInsert: { count: 0 } }, { upsert: true });
  const filter = { user: userId, period };
  if (limit != null) filter.count = { $lt: limit };
  const doc = await Usage.findOneAndUpdate(filter, { $inc: { count: 1 } }, { new: true });
  if (!doc) return null;
  Daily.updateOne({ user: userId, day: dayOf() }, { $inc: { count: 1 } }, { upsert: true }).catch(() => {});
  return doc.count;
}

/** Give a scan back (failed scans - bad photo, engine error - are not billed). */
export async function refund(userId) {
  await Usage.updateOne({ user: userId, period: periodOf(), count: { $gt: 0 } }, { $inc: { count: -1 } });
  Daily.updateOne({ user: userId, day: dayOf(), count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
}

export async function dailySeries(userId, days = 30) {
  const since = new Date(Date.now() - (days - 1) * 86400000);
  const rows = await Daily.find({ user: userId, day: { $gte: dayOf(since) } });
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOf(new Date(Date.now() - i * 86400000));
    out.push({ day, count: map.get(day) || 0 });
  }
  return out;
}
