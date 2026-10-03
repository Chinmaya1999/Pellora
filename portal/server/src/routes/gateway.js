import { Router } from "express";
import multer from "multer";
import { requireApiKey, requireAuth, checkRate } from "../middleware/auth.js";
import { effectivePlan } from "../plans.js";
import { metered, framingCheck } from "../engine.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
  .single("image");

const parse = (req, res, next) => upload(req, res, (err) => {
  if (!err) return next();
  const big = err.code === "LIMIT_FILE_SIZE";
  res.status(big ? 413 : 400).json({ error: big ? "image_too_large" : "bad_upload", message: big ? "Image larger than 10 MB." : "Invalid upload." });
});

// ---- Public customer API:  POST /v1/analyze   (X-API-Key)
export const publicApi = Router();
publicApi.get("/health", (req, res) => res.json({ status: "ok" }));
publicApi.post("/analyze", requireApiKey, parse, metered);

// ---- Dashboard playground (logged-in session, same quota)
export const playground = Router();
playground.post("/analyze", requireAuth, parse, (req, res, next) => {
  req.plan = effectivePlan(req.user); next();
}, metered);

// Live framing check for auto-capture: free, but throttled per user.
playground.post("/check", requireAuth, parse, async (req, res) => {
  if (checkRate(`pg:${req.user.id}`, 400)) return res.status(429).json({ ready: false, message: "Slow down" });
  if (!req.file) return res.status(400).json({ ready: false, message: "No frame" });
  try { res.json(await framingCheck(req.file)); }
  catch { res.status(502).json({ ready: false, message: "Engine unavailable" }); }
});
