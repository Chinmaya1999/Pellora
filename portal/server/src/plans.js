// Edit prices / limits here. Prices are in INR (rupees); Razorpay gets paise.
// Credits: 1 scan = 1 credit, with the AI second opinion = 2 credits. Failed scans cost nothing.
// Each plan has a DAILY and a MONTHLY credit cap (null = unlimited). Edit freely.
export const CREDIT_COST = { scan: 1, ai: 2 };

export const PLANS = {
  free: {
    id: "free", name: "Free", priceInr: 0, dailyCredits: 10, monthlyCredits: 50, rpm: 10, ai: false,
    blurb: "Try the API on real photos.",
    features: ["10 credits / day", "50 credits / month", "All 15 skin metrics + overlays", "10 requests / minute", "Community support"],
  },
  starter: {
    id: "starter", name: "Starter", priceInr: 1999, dailyCredits: 150, monthlyCredits: 3000, rpm: 60, ai: false,
    blurb: "For small shops and early launches.",
    features: ["150 credits / day", "3,000 credits / month", "All 15 skin metrics + overlays", "60 requests / minute", "Email support"],
  },
  growth: {
    id: "growth", name: "Growth", priceInr: 7999, dailyCredits: 600, monthlyCredits: 12000, rpm: 180, ai: true, popular: true,
    blurb: "For growing brands with real traffic.",
    features: ["600 credits / day", "12,000 credits / month", "AI second opinion (2 credits)", "180 requests / minute", "Priority support"],
  },
  enterprise: {
    id: "enterprise", name: "Enterprise", priceInr: null, dailyCredits: null, monthlyCredits: null, rpm: 600, ai: true, contact: true,
    blurb: "Custom volume, SLA and white-label.",
    features: ["Custom credit volume", "AI second opinion", "Dedicated support & SLA", "White-label option"],
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
