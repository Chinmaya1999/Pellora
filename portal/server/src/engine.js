import { config } from "./config.js";
import { creditCost } from "./plans.js";
import { consume, refund, logUsage, nextDayReset, nextMonthReset } from "./usage.js";

function toForm(file, fields) {
  const fd = new FormData();
  fd.append("image", new Blob([file.buffer], { type: file.mimetype || "image/jpeg" }), file.originalname || "face.jpg");
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  return fd;
}

const headers = () => (config.engineKey ? { "X-API-Key": config.engineKey } : {});

/** Credit-metered scan. Sends the response itself and records a usage-history row. */
export async function metered(req, res) {
  const { user, plan, file } = req;
  const t0 = Date.now();
  const source = req.keyName ? "api" : "playground";
  const wantsAi = String(req.body.use_ai) === "true";
  const wantsOverlays = String(req.body.overlays) !== "false"; // on by default
  const base = { user: user._id, source, keyName: req.keyName || "Dashboard playground", ai: wantsAi, overlays: wantsOverlays };
  const done = (httpStatus, status, extra = {}) =>
    logUsage({ ...base, status, httpStatus, ms: Date.now() - t0, ...extra });
  const reject = (httpStatus, error, message) => {
    done(httpStatus, "rejected", { errorCode: error });
    return res.status(httpStatus).json({ error, message });
  };

  if (!file) return reject(400, "missing_image", "Send the photo as multipart field 'image'.");
  if (wantsAi && !plan.ai) return reject(403, "plan_upgrade_required", `AI second opinion needs the Growth plan or higher (you are on ${plan.name}).`);

  const cost = wantsAi ? creditCost().ai : creditCost().scan;
  const taken = await consume(user._id, plan, cost);
  if (!taken.ok) {
    res.set("Retry-After", String(Math.ceil(((taken.reason === "daily" ? nextDayReset() : nextMonthReset()) - Date.now()) / 1000)));
    return taken.reason === "daily"
      ? reject(429, "daily_limit_exceeded", `Daily limit of ${plan.dailyCredits} credits reached on the ${plan.name} plan. It resets at midnight (IST), or upgrade for more.`)
      : reject(402, "quota_exceeded", `Monthly limit of ${plan.monthlyCredits} credits reached on the ${plan.name} plan. Upgrade to continue.`);
  }
  if (plan.dailyCredits != null) {
    res.set("X-Credits-Cost", String(cost));
    res.set("X-Credits-Daily-Remaining", String(Math.max(0, plan.dailyCredits - taken.day)));
    res.set("X-Credits-Monthly-Remaining", String(Math.max(0, plan.monthlyCredits - taken.month)));
  }
  const failed = (httpStatus, errorCode) => { refund(user._id, cost); done(httpStatus, "failed", { errorCode, credits: 0 }); };

  try {
    const r = await fetch(`${config.engineUrl}/v1/analyze`, {
      method: "POST", headers: headers(),
      body: toForm(file, { use_ai: wantsAi, overlay: String(req.body.overlay) === "true", overlays: wantsOverlays }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      failed(r.status, body.error || "engine_error"); // bad photo / engine problem: not billed
      return res.status(r.status >= 500 ? 502 : r.status).json(
        r.status >= 500 ? { error: "engine_error", message: "Analysis engine error. Please retry." } : body);
    }
    done(200, "success", { credits: cost });
    res.json(body);
  } catch {
    failed(502, "engine_unavailable");
    res.status(502).json({ error: "engine_unavailable", message: "Analysis engine unavailable. Please retry shortly." });
  }
}

/** Free framing check for the live-camera playground (not metered). */
export async function framingCheck(file) {
  const r = await fetch(`${config.engineUrl}/v1/check`, {
    method: "POST", headers: headers(), body: toForm(file, {}), signal: AbortSignal.timeout(10_000),
  });
  return r.json();
}
