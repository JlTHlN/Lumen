import type { SVGProps } from "react";

export const BRAND = {
  name: "Lumen",
  tagline: "The diary that remembers what you watched.",
  description:
    "Track every movie, show and game you touch. Self-hosted, mobile-first and private.",
  version: "1.1.0",
};

/**
 * Lumen mark — a soft rounded square frame with an "L." monogram.
 * Scales cleanly, works at 16px (favicon) and 128px (settings header).
 */
export function LumenMark({
  size = 32,
  tone = "accent",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; tone?: "accent" | "mono" | "ghost" }) {
  const fill = tone === "mono" ? "#F5F3FF" : tone === "ghost" ? "transparent" : "url(#lumen-grad)";
  const stroke = tone === "ghost" ? "#A855F7" : "none";
  const text = tone === "ghost" ? "#A855F7" : "#F5F3FF";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Lumen"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="lumen-grad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A855F7" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" ry="16" fill={fill} stroke={stroke} strokeWidth={tone === "ghost" ? 3 : 0} />
      <path
        d="M22 18 V46 H42"
        fill="none"
        stroke={text}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="46" r="3.5" fill={text} />
    </svg>
  );
}

/** Wordmark: mark + name laid out horizontally. */
export function LumenWordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-display">
      <LumenMark size={size + 10} />
      <span
        className="font-black tracking-tight text-ink"
        style={{ fontSize: size, letterSpacing: "-0.02em" }}
      >
        Lumen
      </span>
    </span>
  );
}
