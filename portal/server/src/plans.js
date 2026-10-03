// Edit prices / limits here. Prices are in INR (rupees); Razorpay gets paise.
export const PLANS = {
  free: {
    id: "free", name: "Free", priceInr: 0, scans: 100, rpm: 10, ai: false,
    blurb: "Try the API on real photos.",
    features: ["100 scans / month", "All 15 skin metrics", "10 requests / minute", "Community support"],
  },
  starter: {
    id: "starter", name: "Starter", priceInr: 1999, scans: 2000, rpm: 60, ai: false,
    blurb: "For small shops and early launches.",
    features: ["2,000 scans / month", "All 15 skin metrics", "Analysis overlay image", "60 requests / minute", "Email support"],
  },
  growth: {
    id: "growth", name: "Growth", priceInr: 7999, scans: 10000, rpm: 180, ai: true, popular: true,
    blurb: "For growing brands with real traffic.",
    features: ["10,000 scans / month", "AI second opinion (higher accuracy)", "180 requests / minute", "Priority support"],
  },
  enterprise: {
    id: "enterprise", name: "Enterprise", priceInr: null, scans: null, rpm: 600, ai: true, contact: true,
    blurb: "Custom volume, SLA and white-label.",
    features: ["Custom scan volume", "AI second opinion", "Dedicated support & SLA", "White-label option"],
  },
};

export const PLAN_DAYS = 30;

export const publicPlans = () => Object.values(PLANS);

/** Plan the user is entitled to right now (paid plans lapse back to free). */
export function effectivePlan(user) {
  const p = PLANS[user.plan] || PLANS.free;
  if (p.id !== "free" && (!user.planExpiresAt || user.planExpiresAt < new Date())) return PLANS.free;
  return p;
}
