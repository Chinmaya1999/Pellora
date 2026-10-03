// One place to rename the product.
export const BRAND = "Pellora";
export const TAGLINE = "Skin intelligence API";
export const SALES_EMAIL = "devincode1@gmail.com";

// Public API address for docs and code samples (set at build time in CI).
export const API_BASE = import.meta.env.VITE_API_BASE || (typeof location !== "undefined" ? location.origin : "");
