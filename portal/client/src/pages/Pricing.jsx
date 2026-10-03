import { Link } from "react-router-dom";
import PlanCards from "../components/PlanCards";
import { SALES_EMAIL } from "../brand";

const FAQ = [
  ["What counts as a scan?", "One successful analysis = 1 scan = 1 request. A scan with the AI second opinion counts as 2. Photos rejected for quality (too dark, no face, eyes closed…) and engine errors are never counted."],
  ["What are the rate limits?", "Every plan has requests per minute, per day and per month limits (for example Starter: 50 / minute, 500 / day, 2,500 / month). Over a limit, the API answers HTTP 429 (per minute or per day) or 402 (monthly)."],
  ["What happens after my monthly scans run out?", "On paid plans you can keep scanning at the overage rate (Starter ₹3, Growth ₹2.25, Professional ₹1.50 per scan, plus 18% GST), taken from a prepaid wallet you top up in the dashboard. Daily limits still apply. The Free plan stops until next month."],
  ["Is GST included?", "Prices are shown without GST. 18% GST is added at checkout and shown on your payment receipt."],
  ["Can I change plans?", "Yes. Start a higher plan any time from your dashboard; it starts immediately and lasts 30 days."],
  ["What are skin parameters?", "The number of skin concerns returned per scan: Free 4, Starter 8, Growth 12, Professional 15 (spots, pores, texture, redness, dark circles, wrinkles, acne, oiliness, moisture, firmness, radiance, eye bags, eyelids and under-eye hollows)."],
  ["Do you offer white-label or custom volume?", "Yes. Contact sales."],
];

export default function Pricing() {
  return (
    <main className="wrap section">
      <h1 className="center-t">Pricing</h1>
      <p className="lead center-t">Pay for scans, not seats. Prices in INR excluding 18% GST, billed securely through Cashfree (UPI, cards, netbanking, wallets).</p>
      <PlanCards action={(p) => p.contact
        ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
        : <Link className={`btn block ${p.popular ? "" : "ghost"}`} to="/signup">{p.priceInr ? `Choose ${p.name}` : "Start free"}</Link>} />
      <h2 className="center-t" style={{ marginTop: 64 }}>Questions</h2>
      <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </main>
  );
}
