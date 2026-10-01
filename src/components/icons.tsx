import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Filled variant helper (star/heart) — no stroke, uses currentColor fill. */
function Solid({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ------------------------------ navigation ------------------------------ */

export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 10.6 12 3.5l9 7.1" />
    <path d="M5.6 9.4V20a1 1 0 0 0 1 1h3.9v-5.2a1.5 1.5 0 0 1 1.5-1.5h0a1.5 1.5 0 0 1 1.5 1.5V21h3.9a1 1 0 0 0 1-1V9.4" />
  </Base>
);

export const IconFilm = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7.5 4v16M16.5 4v16M3 9.3h4.5M3 14.7h4.5M16.5 9.3H21M16.5 14.7H21" />
  </Base>
);

export const IconTv = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="7.5" width="19" height="13" rx="2.5" />
    <path d="m8 3.2 4 4.3 4-4.3" />
  </Base>
);

export const IconGamepad = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.5 8h9a4.8 4.8 0 0 1 4.7 5.7l-.5 2.6A3 3 0 0 1 15.4 18l-1.2-1.4H9.8L8.6 18a3 3 0 0 1-5.3-1.7l-.5-2.6A4.8 4.8 0 0 1 7.5 8Z" />
    <path d="M7.6 11.4v2.2M6.5 12.5h2.2" />
    <path d="M15.6 11.9h.01M17.6 13.6h.01" />
  </Base>
);

export const IconList = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.5 6h12M8.5 12h12M8.5 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.2 20.2-4.1-4.1" />
  </Base>
);

export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 9.2a6 6 0 1 0-12 0c0 4.6-1.8 5.9-1.8 5.9h15.6S18 13.8 18 9.2Z" />
    <path d="M13.7 18.6a2 2 0 0 1-3.4 0" />
  </Base>
);

export const IconSettings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H4.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1A1.8 1.8 0 1 1 7.8 4.4l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z" />
  </Base>
);

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16.4V11.6M12 8.1h.01" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

/* -------------------------------- actions ------------------------------- */

export const IconCheck = (p: IconProps) => (
  <Base {...p} strokeWidth={2.25}>
    <path d="m4.8 12.6 4.6 4.6L19.4 7" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p} strokeWidth={2.25}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconX = (p: IconProps) => (
  <Base {...p} strokeWidth={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconPlay = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.5 5.3a1 1 0 0 1 1.5-.9l8.4 5.2a1.2 1.2 0 0 1 0 2l-8.4 5.2a1 1 0 0 1-1.5-.9Z" />
  </Base>
);

export const IconRefresh = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" />
    <path d="M20.6 4.4v5h-5" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 6.8h15M9.4 6.8V5.2a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.6" />
    <path d="M6.6 6.8 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8A1.6 1.6 0 0 0 16.5 19l.9-12.2" />
    <path d="M10.4 10.6v6M13.6 10.6v6" />
  </Base>
);

export const IconEdit = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10Z" />
    <path d="m14.4 6.6 3 3" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16.4V4.6M7.6 9 12 4.6 16.4 9" />
    <path d="M4.4 15v3.4a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6V15" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.6v11.8M7.6 12 12 16.4 16.4 12" />
    <path d="M4.4 15v3.4a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6V15" />
  </Base>
);

export const IconExternal = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19 5 11.5 12.5" />
    <path d="M18 14.6v4a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6V7.4A1.4 1.4 0 0 1 5.4 6h4" />
  </Base>
);

export const IconSend = (p: IconProps) => (
  <Base {...p}>
    <path d="M20.5 3.5 3.8 10.2a.6.6 0 0 0 .05 1.13l6.3 2.1 2.1 6.3a.6.6 0 0 0 1.13.05Z" />
    <path d="m10.2 13.4 4.6-4.6" />
  </Base>
);

/* ------------------------------- chevrons ------------------------------- */

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p} strokeWidth={2}>
    <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p} strokeWidth={2}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p} strokeWidth={2}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />
  </Base>
);

export const IconArrowUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19.5v-15M6.5 10 12 4.5 17.5 10" />
  </Base>
);

export const IconArrowDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.5v15M6.5 14 12 19.5 17.5 14" />
  </Base>
);

/* -------------------------------- status -------------------------------- */

export const IconStar = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" />
  </Base>
);

export const IconStarFilled = (p: IconProps) => (
  <Solid {...p}>
    <path d="m12 3.4 2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.7l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85Z" />
  </Solid>
);

export const IconHeart = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.4C19.5 15.6 12 20 12 20Z" />
  </Base>
);

export const IconHeartFilled = (p: IconProps) => (
  <Solid {...p}>
    <path d="M12 20.4S4 15.8 4 10.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 8 2.9c0 5.3-8 9.9-8 9.9Z" />
  </Solid>
);

export const IconThumbUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.4 10.6 11 3.6a2.2 2.2 0 0 1 2.2 2.2v3.4h4.4a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7.4" />
    <rect x="3.2" y="10.6" width="4.2" height="9.6" rx="1.2" />
  </Base>
);

export const IconThumbDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.4 13.4 11 20.4a2.2 2.2 0 0 0 2.2-2.2v-3.4h4.4a2 2 0 0 0 2-2.3l-1-6a2 2 0 0 0-2-1.7H7.4" />
    <rect x="3.2" y="3.8" width="4.2" height="9.6" rx="1.2" />
  </Base>
);

export const IconCheckCircle = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m8.4 12.3 2.5 2.5 4.7-5" />
  </Base>
);

export const IconWarning = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.6 4.2 2.9 17.5a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.2a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 9.4v4M12 16.6h.01" />
  </Base>
);

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2" />
    <path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" />
  </Base>
);

/* --------------------------------- meta --------------------------------- */

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.2" />
    <path d="M3.6 10h16.8M8.4 3.4v3.4M15.6 3.4v3.4" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.2 2" />
  </Base>
);

export const IconKey = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="12" r="4.2" />
    <path d="M12.2 12H21M17.6 12v3.2M20.2 12v2.4" />
  </Base>
);

export const IconDatabase = (p: IconProps) => (
  <Base {...p}>
    <ellipse cx="12" cy="6.2" rx="7.6" ry="3" />
    <path d="M4.4 6.2v11.6c0 1.7 3.4 3 7.6 3s7.6-1.3 7.6-3V6.2" />
    <path d="M4.4 12c0 1.7 3.4 3 7.6 3s7.6-1.3 7.6-3" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.2 10.2 12.6 4.5 10.8 10.2 9Z" />
    <path d="M18.4 16.2 19.1 18.3 21.2 19 19.1 19.7 18.4 21.8 17.7 19.7 15.6 19 17.7 18.3Z" />
  </Base>
);

export const IconFlame = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21.2c3.6 0 6.2-2.5 6.2-5.8 0-4.4-4.2-6-4.2-10.4 0-1-.3-1.8-.8-2.4-1.7 1.6-4.6 4.4-4.6 7.4 0 1.3-.8 1.9-1.5 1.9-.9 0-1.6-.7-1.7-1.9-1 1.3-1.6 2.9-1.6 4.6 0 3.3 2.6 6.6 8.2 6.6Z" />
  </Base>
);

export const IconTrophy = (p: IconProps) => (
  <Base {...p}>
    <path d="M7.4 4.4h9.2v4.2a4.6 4.6 0 0 1-9.2 0Z" />
    <path d="M7.4 6H4.8v1.4A3.4 3.4 0 0 0 8 10.8M16.6 6h2.6v1.4a3.4 3.4 0 0 1-3.2 3.4" />
    <path d="M12 13.2v3.4M8.6 20.2h6.8l-.7-3.6H9.3Z" />
  </Base>
);

export const IconDice = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" />
    <path d="M8.4 8.4h.01M15.6 8.4h.01M12 12h.01M8.4 15.6h.01M15.6 15.6h.01" strokeWidth={2.4} />
  </Base>
);

export const IconParty = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.4 19.6 9 9.4l5.6 5.6Z" />
    <path d="M13.6 4.2 14 6M18.6 6.4 17.2 7.8M20.4 11.4h-1.8M15.4 8.6l4.4-4.4" />
  </Base>
);

export const IconGrid = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.8" y="3.8" width="7" height="7" rx="1.8" />
    <rect x="13.2" y="3.8" width="7" height="7" rx="1.8" />
    <rect x="3.8" y="13.2" width="7" height="7" rx="1.8" />
    <rect x="13.2" y="13.2" width="7" height="7" rx="1.8" />
  </Base>
);

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h16" />
    <rect x="5.4" y="11.4" width="3.4" height="6" rx="1" />
    <rect x="10.6" y="7.2" width="3.4" height="10.2" rx="1" />
    <rect x="15.8" y="13.6" width="3.4" height="3.8" rx="1" />
  </Base>
);

export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

export const IconNote = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.4 4.6h13.2v11l-4 4H5.4Z" />
    <path d="M18.6 15.6h-4v4M8.6 8.6h6.8M8.6 11.8h4.4" />
  </Base>
);

export const IconLayers = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3.6 8.4 4.2L12 12 3.6 7.8Z" />
    <path d="m3.6 12 8.4 4.2 8.4-4.2M3.6 16.2 12 20.4l8.4-4.2" />
  </Base>
);

export const IconTarget = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1" strokeWidth={2.4} />
  </Base>
);

export const IconSliders = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 20v-6.4M5 9.8V4M12 20v-9.4M12 6.8V4M19 20v-4.4M19 11.8V4" />
    <path d="M2.6 11.8h4.8M9.6 8.8h4.8M16.6 13.8h4.8" />
  </Base>
);

/* --------------------------- composite helpers -------------------------- */

/** Media-type icon used by activity feeds and badges. */
export function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  if (type === "tv") return <IconTv size={size} />;
  if (type === "game") return <IconGamepad size={size} />;
  return <IconFilm size={size} />;
}

/** Star rating rendered as 5 stars with fractional fill. */
export function StarRating({ value, size = 12 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  const stars = (filled: boolean): ReactNode => (
    <span className="flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((index) =>
        filled ? <IconStarFilled key={index} size={size} /> : <IconStar key={index} size={size} strokeWidth={1.4} />,
      )}
    </span>
  );
  return (
    <span className="relative inline-flex align-middle" aria-label={`${value.toFixed(1)} out of 10`}>
      <span className="text-line">{stars(false)}</span>
      <span className="absolute inset-0 overflow-hidden text-glow" style={{ width: `${pct}%` }}>
        {stars(true)}
      </span>
    </span>
  );
}
