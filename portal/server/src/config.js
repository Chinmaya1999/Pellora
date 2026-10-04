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
  // Cashfree Payment Gateway (https://merchant.cashfree.com). CASHFREE_ENV: "sandbox" (test keys) or "production" (live keys)
  cashfreeAppId: env.CASHFREE_APP_ID || "",
  cashfreeSecret: env.CASHFREE_SECRET_KEY || "",
  // Live keys (cfsk_ma_prod_...) only work against the production API and test keys against the sandbox,
  // so trust the key itself over CASHFREE_ENV, which is easy to leave at its "sandbox" default.
  cashfreeEnv: /^cfsk_ma_prod/.test(env.CASHFREE_SECRET_KEY || "") ? "production"
    : /^cfsk_ma_test/.test(env.CASHFREE_SECRET_KEY || "") ? "sandbox"
    : env.CASHFREE_ENV === "production" ? "production" : "sandbox",
  publicUrl: (env.PUBLIC_URL || "http://localhost:5173").replace(/\/$/, ""),
  apiPublicUrl: (env.API_PUBLIC_URL || "").replace(/\/$/, ""),
  brand: env.BRAND_NAME || "Pellora",
};

// Free test checkout (credits without paying) only when explicitly enabled and never in production.
export const devCheckoutAllowed = !isProd && env.ALLOW_DEV_CHECKOUT === "1";
export const paymentsEnabled = Boolean(config.cashfreeAppId && config.cashfreeSecret);
