import { Usage, Daily, UsageLog } from "./models/index.js";

// Daily / monthly windows reset at local midnight of this UTC offset (default IST, +5:30).
const OFFSET_MIN = Number(process.env.RESET_UTC_OFFSET_MIN ?? 330);
const shift = (d) => new Date(d.getTime() + OFFSET_MIN * 60000);

export const dayOf = (d = new Date()) => shift(d).toISOString().slice(0, 10);
export const periodOf = (d = new Date()) => shift(d).toISOString().slice(0, 7);

export function nextDayReset(d = new Date()) {
  const s = shift(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + 1) - OFFSET_MIN * 60000);
}
export function nextMonthReset(d = new Date()) {
  const s = shift(d);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1) - OFFSET_MIN * 60000);
}

export async function usedNow(userId) {
  const [m, d] = await Promise.all([
    Usage.findOne({ user: userId, period: periodOf() }),
    Daily.findOne({ user: userId, day: dayOf() }),
  ]);
  return { month: m?.count || 0, day: d?.count || 0 };
}

/**
 * Atomically take `cost` credits from BOTH the daily and the monthly allowance.
 * Returns { ok: true, day, month } or { ok: false, reason: "daily" | "monthly" }.
 */
export async function consume(userId, plan, cost) {
  const day = dayOf(), period = periodOf();
  await Promise.all([
    Daily.updateOne({ user: userId, day }, { $setOnInsert: { count: 0 } }, { upsert: true }),
    Usage.updateOne({ user: userId, period }, { $setOnInsert: { count: 0 } }, { upsert: true }),
  ]);
  const dFilter = { user: userId, day };
  if (plan.dailyCredits != null) dFilter.count = { $lte: plan.dailyCredits - cost };
  const d = await Daily.findOneAndUpdate(dFilter, { $inc: { count: cost } }, { new: true });
  if (!d) return { ok: false, reason: "daily" };

  const mFilter = { user: userId, period };
  if (plan.monthlyCredits != null) mFilter.count = { $lte: plan.monthlyCredits - cost };
  const m = await Usage.findOneAndUpdate(mFilter, { $inc: { count: cost } }, { new: true });
  if (!m) { // monthly cap hit: undo the daily charge
    await Daily.updateOne({ user: userId, day }, { $inc: { count: -cost } });
    return { ok: false, reason: "monthly" };
  }
  return { ok: true, day: d.count, month: m.count };
}

/** Give credits back (failed scans - bad photo, engine error - are free). */
export async function refund(userId, cost, when = new Date()) {
  await Promise.all([
    Daily.updateOne({ user: userId, day: dayOf(when), count: { $gte: cost } }, { $inc: { count: -cost } }),
    Usage.updateOne({ user: userId, period: periodOf(when), count: { $gte: cost } }, { $inc: { count: -cost } }),
  ]);
}

export const logUsage = (row) => UsageLog.create(row).catch(() => {});

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
