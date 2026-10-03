import { useId } from "react";

export function LogoMark({ size = 32 }) {
  const id = "lg" + useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" /><stop offset=".55" stopColor="#8b5cf6" /><stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <ellipse cx="32" cy="33" rx="12" ry="15" fill="none" stroke="#fff" strokeWidth="3.2" />
      <path d="M14 24v-6a4 4 0 0 1 4-4h6M50 24v-6a4 4 0 0 0-4-4h-6M14 42v6a4 4 0 0 0 4 4h6M50 42v6a4 4 0 0 1-4 4h-6" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".92" />
      <path className="logo-scan" d="M22 33h20" stroke="#a5f3fc" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
