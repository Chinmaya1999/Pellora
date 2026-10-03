import dotenv from "dotenv";
dotenv.config();

const env = process.env;
const isProd = env.NODE_ENV === "production";

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error("Set JWT_SECRET (32+ chars) in production");
}

export const config = {
  isProd,
  port: Number(env.PORT || 4000),
  mongoUri: env.MONGO_URI || "mongodb://127.0.0.1:27017/skin_portal",
  jwtSecret: env.JWT_SECRET || "dev-only-secret-change-me-dev-only-secret",
  clientOrigin: env.CLIENT_ORIGIN || "http://localhost:5173",
  // The Python skin-analysis engine (kept private; only this server calls it)
  engineUrl: (env.ENGINE_URL || "http://127.0.0.1:8000").replace(/\/$/, ""),
  engineKey: env.ENGINE_KEY || "",
  razorpayKeyId: env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || "",
  brand: env.BRAND_NAME || "Pellora",
};

export const razorpayEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret);
