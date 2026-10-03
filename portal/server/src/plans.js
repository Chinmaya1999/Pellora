// Plans and global settings live in MongoDB so the admin dashboard can edit them.
// These defaults only seed an empty database (and migrate older defaults once).
// Terminology: 1 scan = 1 request = 1 "credit" internally. AI second opinion counts as 2.
import { Plan, Setting } from "./models/index.js";

export const METRIC_KEYS = ["spots", "pores", "texture", "redness", "dark_circles", "wrinkles", "acne", "oiliness",
  "moisture", "firmness", "radiance", "eye_bags", "upper_eyelid_droopiness", "lower_eyelid_droopiness", "under_eye_hollows"];
export const METRIC_LABELS = {
  spots: "Spots", pores: "Pores", texture: "Texture", redness: "Redness", dark_circles: "Dark circles", wrinkles: "Wrinkles",
  acne: "Acne", oiliness: "Oiliness", moisture: "Moisture", firmness: "Firmness", radiance: "Radiance", eye_bags: "Eye bags",
  upper_eyelid_droopiness: "Upper eyelid", lower_eyelid_droopiness: "Lower eyelid", under_eye_hollows: "Under-eye hollows",
};
const TIER4 = ["spots", "pores", "texture", "redness"];
const TIER8 = [...TIER4, "dark_circles", "wrinkles", "acne", "oiliness"];
const TIER12 = [...TIER8, "moisture", "radiance", "eye_bags", "under_eye_hollows"];

const SOON = " (Coming soon)";
const DEFAULT_PLANS = [
  { id: "free", name: "Free", priceInr: 0, dailyCredits: 10, monthlyCredits: 150, rpm: 10, ai: false, order: 1, metrics: TIER4, overageInr: null,
    blurb: "Build and test. 150 scans a month, forever. No credit card.", extraFeatures: ["Docs and community support"] },
  { id: "starter", name: "Starter", priceInr: 4999, dailyCredits: 500, monthlyCredits: 2500, rpm: 50, ai: false, order: 2, metrics: TIER8, overageInr: 3,
    blurb: "Indie D2C brands: scanning plus basic product recommendations.", extraFeatures: ["Product recommendations (up to 50 SKUs)", "Email support (72h)", "Branching quiz logic" + SOON] },
  { id: "growth", name: "Growth", priceInr: 14999, dailyCredits: 2000, monthlyCredits: 10000, rpm: 150, ai: true, popular: true, order: 3, metrics: TIER12, overageInr: 2.25,
    blurb: "From scan tool to retention engine. The plan most D2C brands start on.", extraFeatures: ["REST API access", "Up to 500 SKUs, CSV upload, ingredient matching", "Skin diary and routine streaks" + SOON, "WhatsApp reminders" + SOON] },
  { id: "professional", name: "Professional", priceInr: 49999, dailyCredits: 8000, monthlyCredits: 50000, rpm: 500, ai: true, order: 4, metrics: [], overageInr: 1.5,
    blurb: "Everything in Growth at scale, for large brands and clinic chains.", extraFeatures: ["Up to 2,000 SKUs", "Email support (8h) + chat", "Mobile SDK" + SOON, "Before/after photo tracking" + SOON] },
  { id: "enterprise", name: "Enterprise", priceInr: null, dailyCredits: null, monthlyCredits: null, rpm: 1000, ai: true, contact: true, active: false, order: 9, metrics: [], overageInr: null,
    blurb: "Custom volume, SLA and white-label.", extraFeatures: ["Dedicated support & SLA", "White-label option"] },
];
const DEFAULT_SETTINGS = { creditCost: { scan: 1, ai: 2 }, planDays: 30, gstPercent: 18, topupOptions: [500, 1000, 2500, 5000], topupMin: 500 };
const DEFAULTS_VERSION = 3; // bump to overwrite the standard plans once on the next start

let plans = new Map();
let settings = structuredClone(DEFAULT_SETTINGS);

const plain = (d) => ({
  id: d.id, name: d.name, priceInr: d.priceInr, dailyCredits: d.dailyCredits, monthlyCredits: d.monthlyCredits,
  rpm: d.rpm, ai: d.ai, blurb: d.blurb, extraFeatures: d.extraFeatures || [], popular: !!d.popular,
  contact: !!d.contact, active: d.active !== false, order: d.order ?? 100, overageInr: d.overageInr ?? null,
  metrics: (d.metrics && d.metrics.length ? d.metrics : METRIC_KEYS).filter((k) => METRIC_KEYS.includes(k)),
});

/** (Re)load plans + settings from the database. Called at startup and after every admin change. */
export async function loadConfig() {
  const ver = await Setting.findOne({ key: "defaults_version" });
  if (!(await Plan.countDocuments()) || (ver?.value ?? 0) < DEFAULTS_VERSION) {
    for (const p of DEFAULT_PLANS) await Plan.updateOne({ id: p.id }, { $set: p }, { upsert: true });
    await Setting.updateOne({ key: "defaults_version" }, { value: DEFAULTS_VERSION }, { upsert: true });
  }
  plans = new Map((await Plan.find()).map((d) => [d.id, plain(d)]));
  const s = await Setting.findOne({ key: "global" });
  const v = s?.value || {};
  settings = { ...DEFAULT_SETTINGS, ...v, creditCost: { ...DEFAULT_SETTINGS.creditCost, ...(v.creditCost || {}) } };
}

export const getSettings = () => settings;
export const creditCost = () => settings.creditCost;
export const planDays = () => settings.planDays;
export const gstPercent = () => settings.gstPercent;
export const getPlan = (id) => plans.get(id);
export const allPlans = () => [...plans.values()].sort((a, b) => a.order - b.order);

/** Money helpers - all in paise so there are never rounding surprises. */
export const withGstPaise = (rupees) => Math.round(rupees * (100 + settings.gstPercent));         // ₹ -> paise incl. GST
export const gstOfPaise = (basePaise) => Math.round((basePaise * settings.gstPercent) / 100);
/** Wallet charge for ONE overage scan, in paise incl. GST. */
export const overageUnitPaise = (plan) => (plan.overageInr == null ? null : withGstPaise(plan.overageInr));

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** The feature list shown on pricing cards - generated from the numbers so it can never drift out of date. */
export function describe(p) {
  const n = (v) => v.toLocaleString("en-IN");
  const f = [];
  if (p.monthlyCredits == null && p.dailyCredits == null) f.push("Custom scan volume");
  else f.push(p.monthlyCredits == null ? "No monthly cap" : `${n(p.monthlyCredits)} scans/month`);
  if (p.overageInr != null && p.monthlyCredits != null) f.push(`Overage: ${inr(p.overageInr)} + GST/scan`);
  f.push(`${p.metrics.length} skin parameters`);
  const lim = [`${n(p.rpm)} requests/minute`];
  if (p.dailyCredits != null) lim.push(`${n(p.dailyCredits)}/day`);
  f.push(lim.join(" · "));
  if (p.ai) f.push(`AI second opinion (${creditCost().ai} scans)`);
  return [...f, ...p.extraFeatures];
}
export const publicPlan = (p) => ({
  ...p, features: describe(p), gstPercent: settings.gstPercent,
  priceWithGst: p.priceInr ? withGstPaise(p.priceInr) / 100 : p.priceInr,
  overageWithGst: p.overageInr != null ? withGstPaise(p.overageInr) / 100 : null,
  parameters: p.metrics.length,
});
export const publicPlans = () => allPlans().filter((p) => p.active).map(publicPlan);

/** Plan the user is entitled to right now (paid plans lapse back to free). */
export function effectivePlan(user) {
  const free = plans.get("free");
  const p = plans.get(user.plan) || free;
  if (p.id !== "free" && (!user.planExpiresAt || user.planExpiresAt < new Date())) return free;
  return p;
}
