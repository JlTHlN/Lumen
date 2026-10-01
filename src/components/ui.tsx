"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconStarFilled, IconWarning, StarRating } from "@/components/icons";

export function Card({
  children = null,
  className = "",
  as = "div",
  href,
}: {
  children?: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  href?: string;
}) {
  const classes = `rounded-2xl border border-line bg-surface/90 shadow-card ${className}`;
  if (href) {
    return (
      <Link href={href} className={`press focusable ${classes} block hover:border-purple/50`}>
        {children}
      </Link>
    );
  }
  const Tag = as;
  return <Tag className={classes}>{children}</Tag>;
}

export function Chip({
  children,
  active = false,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={`press focusable shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-purple bg-purple/20 text-ink shadow-sm shadow-purple/30"
          : "border-line bg-surface/60 text-muted hover:border-purple/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`press focusable shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            active === tab.id
              ? "bg-purple text-white shadow-glow"
              : "border border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleClass =
    size === "lg"
      ? "text-xl font-black tracking-tight text-ink"
      : size === "sm"
        ? "text-[11px] font-bold tracking-[0.2em] text-muted uppercase"
        : "text-[12px] font-bold tracking-[0.18em] text-muted uppercase section-rule";
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className={titleClass}>{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-faint">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-purple to-glow transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function RatingBadge({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return null;
  return (
    <span className="tnum inline-flex items-center gap-1 text-xs font-semibold text-glow">
      <IconStarFilled size={11} />
      {value.toFixed(1)}
      {label ? <span className="font-normal text-faint">{label}</span> : null}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">{label}</p>
      <p className="tnum mt-1 text-2xl font-black tracking-tight text-ink">{value ?? "—"}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-xl bg-elevated ${className}`} aria-hidden />;
}

export function PosterSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="w-[132px] shrink-0 space-y-2 @md/content:w-[150px]">
          <Skeleton className="aspect-[2/3] w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-8 text-center">
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="press focusable mt-4 inline-flex rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-bright"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-bad/40 bg-bad/10 p-4">
      <p className="flex items-start gap-2 text-sm text-ink">
        <IconWarning size={16} className="mt-0.5 shrink-0 text-bad" />
        <span>{message}</span>
      </p>
      <p className="mt-1 text-xs text-muted">Your saved library is still available.</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="press focusable mt-3 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-purple"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-purple/30 border-t-glow ${className}`}
      aria-hidden
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
  title,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "soft";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary: "bg-purple text-white hover:bg-bright shadow-glow",
    soft: "bg-purple/15 text-ink hover:bg-purple/25 border border-purple/30",
    ghost: "text-muted hover:text-ink hover:bg-elevated",
    outline: "border border-line text-ink hover:border-purple/60 bg-surface/50",
    danger: "border border-bad/50 text-bad hover:bg-bad/10",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`press focusable inline-flex items-center justify-center gap-2 rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return <StarRating value={rating} size={size} />;
}

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-black tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
        {meta ? <div className="mt-2 text-xs text-faint">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
