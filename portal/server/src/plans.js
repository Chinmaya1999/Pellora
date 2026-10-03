// Plans and global settings live in MongoDB so the admin dashboard can edit them.
// These defaults are only used to seed an empty database. Credits: 1 scan = 1 credit by default.
import { Plan, Setting } from "./models/index.js";

const DEFAULT_PLANS = [
  { id: "free", name: "Free", priceInr: 0, dailyCredits: 10, monthlyCredits: 50, rpm: 10, ai: false, order: 1,
    blurb: "Try the API on real photos.", extraFeatures: ["Community support"] },
  { id: "starter", name: "Starter", priceInr: 1999, dailyCredits: 150, monthlyCredits: 3000, rpm: 60, ai: false, order: 2,
    blurb: "For small shops and early launches.", extraFeatures: ["Email support"] },
  { id: "growth", name: "Growth", priceInr: 7999, dailyCredits: 600, monthlyCredits: 12000, rpm: 180, ai: true, popular: true, order: 3,
    blurb: "For growing brands with real traffic.", extraFeatures: ["Priority support"] },
  { id: "enterprise", name: "Enterprise", priceInr: null, dailyCredits: null, monthlyCredits: null, rpm: 600, ai: true, contact: true, order: 4,
    blurb: "Custom volume, SLA and white-label.", extraFeatures: ["Dedicated support & SLA", "White-label option"] },
];
const DEFAULT_SETTINGS = { creditCost: { scan: 1, ai: 2 }, planDays: 30 };

let plans = new Map();
let settings = structuredClone(DEFAULT_SETTINGS);

const plain = (d) => ({
  id: d.id, name: d.name, priceInr: d.priceInr, dailyCredits: d.dailyCredits, monthlyCredits: d.monthlyCredits,
  rpm: d.rpm, ai: d.ai, blurb: d.blurb, extraFeatures: d.extraFeatures || [], popular: !!d.popular,
  contact: !!d.contact, active: d.active !== false, order: d.order ?? 100,
});

/** (Re)load plans + settings from the database. Called at startup and after every admin change. */
export async function loadConfig() {
  if (!(await Plan.countDocuments())) await Plan.insertMany(DEFAULT_PLANS);
  plans = new Map((await Plan.find()).map((d) => [d.id, plain(d)]));
  const s = await Setting.findOne({ key: "global" });
  settings = { ...DEFAULT_SETTINGS, ...(s?.value || {}), creditCost: { ...DEFAULT_SETTINGS.creditCost, ...(s?.value?.creditCost || {}) } };
}

export const getSettings = () => settings;
export const creditCost = () => settings.creditCost;
export const planDays = () => settings.planDays;
export const getPlan = (id) => plans.get(id);
export const allPlans = () => [...plans.values()].sort((a, b) => a.order - b.order);

/** The text shown on pricing cards - generated from the numbers so it can never drift out of date. */
export function describe(p) {
  const n = (v) => v.toLocaleString("en-IN");
  const f = [];
  if (p.dailyCredits == null && p.monthlyCredits == null) f.push("Custom credit volume");
  else {
    f.push(p.dailyCredits == null ? "No daily cap" : `${n(p.dailyCredits)} credits / day`);
    f.push(p.monthlyCredits == null ? "No monthly cap" : `${n(p.monthlyCredits)} credits / month`);
  }
  f.push("All 15 skin metrics + overlays", `${n(p.rpm)} requests / minute`);
  if (p.ai) f.push(`AI second opinion (${creditCost().ai} credits)`);
  return [...f, ...p.extraFeatures];
}
export const publicPlan = (p) => ({ ...p, features: describe(p) });
export const publicPlans = () => allPlans().filter((p) => p.active).map(publicPlan);

/** Plan the user is entitled to right now (paid plans lapse back to free). */
export function effectivePlan(user) {
  const free = plans.get("free");
  const p = plans.get(user.plan) || free;
  if (p.id !== "free" && (!user.planExpiresAt || user.planExpiresAt < new Date())) return free;
  return p;
}
