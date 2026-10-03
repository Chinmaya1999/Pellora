import { Link } from "react-router-dom";
import PlanCards from "../components/PlanCards";
import { SALES_EMAIL } from "../brand";

const FAQ = [
  ["What counts as a scan?", "One successful analysis. Photos rejected for quality (too dark, no face, eyes closed…) are not counted against your quota."],
  ["What happens if I hit my limit?", "Requests return HTTP 402 until the month resets or you upgrade. We never charge overage automatically."],
  ["Can I change plans?", "Yes. Upgrade any time from your dashboard; the new plan starts immediately and lasts 30 days."],
  ["Do you offer white-label or custom volume?", "Yes, on the Enterprise plan. Contact sales."],
];

export default function Pricing() {
  return (
    <main className="wrap section">
      <h1 className="center-t">Pricing</h1>
      <p className="lead center-t">Pay for scans, not seats. Prices in INR, billed through Razorpay (UPI, cards, netbanking).</p>
      <PlanCards action={(p) => p.contact
        ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
        : <Link className={`btn block ${p.popular ? "" : "ghost"}`} to="/signup">{p.priceInr ? `Choose ${p.name}` : "Start free"}</Link>} />
      <h2 className="center-t" style={{ marginTop: 64 }}>Questions</h2>
      <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </main>
  );
}
