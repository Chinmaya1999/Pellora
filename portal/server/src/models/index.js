import mongoose from "mongoose";
const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  company: { type: String, trim: true, maxlength: 120, default: "" },
  passwordHash: { type: String, required: true },
  plan: { type: String, default: "free" },
  planExpiresAt: { type: Date, default: null },
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
  status: { type: String, enum: ["created", "paid"], default: "created" },
  mock: { type: Boolean, default: false },
}, { timestamps: true });

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
