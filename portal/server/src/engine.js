import { config } from "./config.js";
import { consume, refund } from "./usage.js";

function toForm(file, fields) {
  const fd = new FormData();
  fd.append("image", new Blob([file.buffer], { type: file.mimetype || "image/jpeg" }), file.originalname || "face.jpg");
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  return fd;
}

const headers = () => (config.engineKey ? { "X-API-Key": config.engineKey } : {});

/** Quota-metered scan. Sends the response itself. */
export async function metered(req, res) {
  const { user, plan, file } = req;
  if (!file) return res.status(400).json({ error: "missing_image", message: "Send the photo as multipart field 'image'." });

  const wantsAi = String(req.body.use_ai) === "true";
  if (wantsAi && !plan.ai) {
    return res.status(403).json({ error: "plan_upgrade_required", message: `AI second opinion needs the Growth plan or higher (you are on ${plan.name}).` });
  }

  const used = await consume(user._id, plan.scans);
  if (used === null) {
    return res.status(402).json({ error: "quota_exceeded", message: `Monthly limit of ${plan.scans} scans reached. Upgrade your plan to continue.` });
  }
  if (plan.scans != null) {
    res.set("X-Quota-Limit", String(plan.scans));
    res.set("X-Quota-Remaining", String(Math.max(0, plan.scans - used)));
  }

  try {
    const r = await fetch(`${config.engineUrl}/v1/analyze`, {
      method: "POST", headers: headers(),
      body: toForm(file, { use_ai: wantsAi, overlay: String(req.body.overlay) === "true", overlays: String(req.body.overlays) === "true" }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      await refund(user._id); // bad photo / engine problem: not billed
      return res.status(r.status >= 500 ? 502 : r.status).json(
        r.status >= 500 ? { error: "engine_error", message: "Analysis engine error. Please retry." } : body);
    }
    res.json(body);
  } catch (e) {
    await refund(user._id);
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
