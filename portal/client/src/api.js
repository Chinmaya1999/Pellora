export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, credentials: "include", headers: {} };
  if (form) opts.body = form;
  else if (body) { opts.headers["content-type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || "Request failed"), { status: res.status, data });
  return data;
}

export const inr = (n) => (n == null ? "Custom" : n === 0 ? "₹0" : `₹${n.toLocaleString("en-IN")}`);
