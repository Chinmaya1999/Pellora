import bcrypt from "bcryptjs";
import { User } from "./models/index.js";

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (only when that account doesn't exist yet). */
export async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email || !password) return;
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") { existing.role = "admin"; await existing.save(); console.log(`Promoted ${email} to admin`); }
    return;
  }
  const u = await User.create({ name: "Admin", email, role: "admin", plan: "enterprise", planExpiresAt: new Date(Date.now() + 3650 * 86400000),
    passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Created admin account ${email}`);
}
