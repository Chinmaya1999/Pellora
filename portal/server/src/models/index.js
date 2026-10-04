import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  company: { type: String, trim: true, maxlength: 120, default: "" },
  phone: { type: String, default: "" },
  passwordHash: { type: String, required: true },
  plan: { type: String, default: "free" },
  planExpiresAt: { type: Date, default: null },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  disabled: { type: Boolean, default: false },
  lastLoginAt: { type: Date, default: null },
  walletPaise: { type: Number, default: 0 },        // prepaid balance for overage scans (incl. GST)
  freeScansUsed: { type: Number, default: 0 },      // lifetime free scans already taken (see Plan.freeScans)
}, { timestamps: true });

const apiKeySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  prefix: String,
  last4: String,
  hash: { type: String, required: true, unique: true },
  revoked: { type: Boolean, default: false },
  lastUsedAt: Date,
}, { timestamps: true });

// Atomic per-month counter used for quota enforcement.
const usageSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  period: { type: String, required: true }, // "2026-10"
  count: { type: Number, default: 0 },
});
usageSchema.index({ user: 1, period: 1 }, { unique: true });

// Per-day counter, for the dashboard chart.
const dailySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // "2026-10-03"
  count: { type: Number, default: 0 },
});
dailySchema.index({ user: 1, day: 1 }, { unique: true });

const paymentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: String,
  amountPaise: Number,
  orderId: { type: String, unique: true, sparse: true },
  paymentId: String,
  kind: { type: String, enum: ["plan", "topup"], default: "plan" },
  basePaise: Number, gstPaise: { type: Number, default: 0 },
  status: { type: String, enum: ["created", "paid"], default: "created" },
  mock: { type: Boolean, default: false },
  manual: { type: Boolean, default: false }, // recorded by an admin (cash / UPI / bank transfer)
  note: { type: String, default: "" },
}, { timestamps: true });

// Plans are editable by the admin (prices, credit caps, rate limits, features).
const planSchema = new Schema({
  id: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  priceInr: { type: Number, default: null },        // null = contact sales
  dailyCredits: { type: Number, default: null },    // scans (= requests) per day, null = unlimited
  monthlyCredits: { type: Number, default: null },
  rpm: { type: Number, default: 10 },
  overageInr: { type: Number, default: null },      // extra scans beyond the monthly allowance, ₹ per scan excl. GST (null = not allowed)
  overageInclGst: { type: Boolean, default: false }, // overageInr is the final price (GST already included)
  freeScans: { type: Number, default: 0 },          // one-time free scans per account before charging
  metrics: { type: [String], default: [] },         // skin parameters returned (empty = all)
  ai: { type: Boolean, default: false },
  blurb: { type: String, default: "", maxlength: 160 },
  extraFeatures: { type: [String], default: [] },
  popular: { type: Boolean, default: false },
  contact: { type: Boolean, default: false },
  active: { type: Boolean, default: true },          // hidden plans can't be bought but existing users keep them
  order: { type: Number, default: 100 },
}, { timestamps: true });

const settingSchema = new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });

const auditSchema = new Schema({
  admin: { type: Schema.Types.ObjectId, ref: "User" },
  adminEmail: String,
  action: String,
  target: String,
  detail: Schema.Types.Mixed,
  at: { type: Date, default: Date.now, index: true },
});

// One row per API / playground request, for the dashboard "Usage history".
const logSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  at: { type: Date, default: Date.now, index: { expires: 90 * 86400 } }, // kept 90 days
  source: { type: String, enum: ["api", "playground"], default: "api" },
  keyName: String,
  status: { type: String, enum: ["success", "failed", "rejected"], required: true },
  httpStatus: Number,
  errorCode: String,
  credits: { type: Number, default: 0 },
  overage: { type: Boolean, default: false },
  chargedPaise: { type: Number, default: 0 },
  ai: { type: Boolean, default: false },
  overlays: { type: Boolean, default: false },
  ms: Number,
});
logSchema.index({ user: 1, at: -1 });

export const User = model("User", userSchema);
export const ApiKey = model("ApiKey", apiKeySchema);
export const Usage = model("Usage", usageSchema);
export const Daily = model("Daily", dailySchema);
export const Payment = model("Payment", paymentSchema);
export const UsageLog = model("UsageLog", logSchema);
export const Plan = model("Plan", planSchema);
export const Setting = model("Setting", settingSchema);
export const AdminLog = model("AdminLog", auditSchema);
