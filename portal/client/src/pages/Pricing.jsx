import { Link } from "react-router-dom";
import PlanCards, { usePlans } from "../components/PlanCards";
import { Reveal } from "../components/Reveal";
import { METRICS } from "../lib/metrics";
import { SALES_EMAIL } from "../brand";

const FAQ = [
  ["What counts as a scan?", "One successful analysis = 1 scan = 1 request. A scan with the AI second opinion counts as 2. Photos rejected for quality (too dark, no face, eyes closed…) and engine errors are never counted."],
  ["What are the rate limits?", "Every plan has requests per minute, per day and per month limits. Over a limit, the API answers HTTP 429 (per minute or per day) or 402 (monthly)."],
  ["What happens after my monthly scans run out?", "On paid plans you can keep scanning at the overage rate, plus 18% GST, taken from a prepaid wallet you top up in the dashboard. Daily limits still apply. The Free plan stops until next month."],
  ["Is GST included?", "Prices are shown without GST. 18% GST is added at checkout and shown on your payment receipt."],
  ["Can I change plans?", "Yes. Start a higher plan any time from your dashboard; it starts immediately and lasts 30 days."],
  ["Do you offer white-label or custom volume?", "Yes. Contact sales and tell us what you need."],
];

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const num = (n) => (n == null ? "Unlimited" : Number(n).toLocaleString("en-IN"));
const Yes = () => <span className="yes" aria-label="Included">✓</span>;
const No = () => <span className="no" aria-label="Not included">—</span>;

function Compare() {
  const data = usePlans();
  if (!data || !data.plans.length) return null;
  const plans = data.plans.filter((p) => !p.contact);
  const rows = [
    ["Price per month (excl. GST)", (p) => (p.priceInr ? inr(p.priceInr) : "Free")],
    ["Total with GST", (p) => (p.priceWithGst ? inr(p.priceWithGst) : "—")],
    ["Scans per month", (p) => num(p.monthlyCredits)],
    ["Requests per minute", (p) => num(p.rpm)],
    ["Requests per day", (p) => num(p.dailyCredits)],
    ["Overage per scan (excl. GST)", (p) => (p.overageInr != null ? inr(p.overageInr) : <No />)],
    ["Skin parameters", (p) => p.parameters],
    ["Overlay image for every parameter", () => <Yes />],
    ["Photo quality checks, never billed", () => <Yes />],
    ["AI second opinion", (p) => (p.ai ? <Yes /> : <No />)],
  ];
  return (
    <section className="wrap section">
      <Reveal className="s-head center-t"><span className="eyebrow">Compare</span><h2>Every plan, side by side</h2></Reveal>
      <div className="cmp-wrap">
        <table className="cmp">
          <thead><tr><th />{plans.map((p) => <th key={p.id} className={p.popular ? "pop" : ""}>{p.name}{p.popular && <em>Most popular</em>}</th>)}</tr></thead>
          <tbody>
            {rows.map(([label, f]) => <tr key={label}><th scope="row">{label}</th>{plans.map((p) => <td key={p.id} className={p.popular ? "pop" : ""}>{f(p)}</td>)}</tr>)}
            <tr className="grp"><th colSpan={plans.length + 1}>Skin parameters returned</th></tr>
            {METRICS.map((m) => (
              <tr key={m.key}><th scope="row">{m.label}</th>{plans.map((p) => <td key={p.id} className={p.popular ? "pop" : ""}>{p.metrics.includes(m.key) ? <Yes /> : <No />}</td>)}</tr>))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Pricing() {
  return (
    <main>
      <section className="page-hero">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <div className="wrap center-t">
          <span className="h-pill"><b>Pricing</b> Start free, scale when you grow</span>
          <h1>Simple pricing that grows with you</h1>
          <p className="h-lead" style={{ margin: "0 auto" }}>Pay for scans, not seats. Prices are in INR, exclude 18% GST and are billed securely through Cashfree (UPI, cards, netbanking, wallets).</p>
        </div>
      </section>

      <section className="wrap section pt0">
        <PlanCards action={(p) => p.contact
          ? <a className="btn ghost block" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
          : <Link className={`btn block ${p.popular ? "" : "ghost"}`} to="/signup">{p.priceInr ? `Start ${p.name}` : "Start for free"}</Link>} />
        <div className="howbill">
          <Reveal className="bcard"><h3>1 request = 1 scan</h3><p>Every plan includes a monthly number of scans plus per-minute and per-day request limits. Failed or rejected photos are free.</p></Reveal>
          <Reveal delay={80} className="bcard"><h3>Overage wallet</h3><p>Past your monthly scans, paid plans keep working at the overage rate, deducted from a prepaid wallet. No surprise invoices.</p></Reveal>
          <Reveal delay={160} className="bcard"><h3>18% GST at checkout</h3><p>Listed prices exclude GST. The total, including GST, is shown on each plan and on your receipt.</p></Reveal>
        </div>
      </section>

      <Compare />

      <section className="alt section">
        <div className="wrap faqwrap">
          <Reveal className="s-head center-t"><span className="eyebrow">FAQ</span><h2>Billing questions</h2></Reveal>
          <Reveal className="faq2">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</Reveal>
        </div>
      </section>

      <section className="final">
        <div className="mesh" aria-hidden><i /><i /><i /></div>
        <Reveal className="wrap center-t">
          <h2>Need more volume, a white-label option or an SLA?</h2>
          <p className="h-lead" style={{ margin: "0 auto 26px" }}>Tell us what you are building and we will put together a plan that fits.</p>
          <div className="h-cta" style={{ justifyContent: "center" }}>
            <a className="btn lg inv" href={`mailto:${SALES_EMAIL}`}>Contact sales</a>
            <Link className="btn lg glass" to="/signup">Start free</Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
