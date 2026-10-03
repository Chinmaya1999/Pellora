import { useState } from "react";
import { API_BASE } from "../brand";

export default function Code({ children, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="code">
      <div className="code-bar"><span>{label}</span><button onClick={copy}>{copied ? "Copied" : "Copy"}</button></div>
      <pre>{children}</pre>
    </div>
  );
}

export const curlExample = (key = "YOUR_API_KEY") => `curl -X POST ${API_BASE}/v1/analyze \\
  -H "X-API-Key: ${key}" \\
  -F image=@selfie.jpg`;

export const jsExample = (key = "YOUR_API_KEY") => `const form = new FormData();
form.append("image", fileInput.files[0]);

const res = await fetch("${API_BASE}/v1/analyze", {
  method: "POST",
  headers: { "X-API-Key": "${key}" },
  body: form,
});
const report = await res.json();
console.log(report.overall_score, report.metrics.pores.score);`;

export const pyExample = (key = "YOUR_API_KEY") => `import requests

r = requests.post(
    "${API_BASE}/v1/analyze",
    headers={"X-API-Key": "${key}"},
    files={"image": open("selfie.jpg", "rb")},
)
print(r.json()["overall_score"])`;
