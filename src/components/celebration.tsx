"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheckCircle, IconTrophy } from "@/components/icons";

type Kind = "watch" | "complete" | "badge";

interface CelebrationApi {
  celebrate: (kind?: Kind, label?: string) => void;
}

const CelebrationContext = createContext<CelebrationApi | null>(null);

export function useCelebration(): CelebrationApi {
  return useContext(CelebrationContext) ?? { celebrate: () => undefined };
}

const COLORS = ["#a855f7", "#c084fc", "#8b5cf6", "#f5f3ff", "#5eead4", "#fbbf24"];

function Burst({ seed, onDone }: { seed: number; onDone: () => void }) {
  const pieces = Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2 + (seed % 7) * 0.2;
    const distance = 90 + ((seed * (index + 3)) % 130);
    return {
      index,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      rotate: (seed * index) % 360,
      delay: (index % 6) * 18,
      color: COLORS[(index + seed) % COLORS.length],
      size: 5 + ((index * seed) % 5),
    };
  });

  useEffect(() => {
    const timer = window.setTimeout(onDone, 1100);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center lg:bottom-32" aria-hidden>
      <div className="relative">
        {pieces.map((piece) => (
          <span
            key={`${seed}-${piece.index}`}
            className="confetti-piece absolute rounded-[2px]"
            style={{
              width: piece.size,
              height: piece.size * 1.6,
              backgroundColor: piece.color,
              // custom properties drive the keyframe offsets
              ["--tx" as string]: `${piece.x}px`,
              ["--ty" as string]: `${piece.y}px`,
              ["--rot" as string]: `${piece.rotate}deg`,
              animationDelay: `${piece.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Toast({ kind, label, onDone }: { kind: Kind; label?: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const copy =
    kind === "badge"
      ? { title: "New badge unlocked", body: label ?? "Nice one." }
      : kind === "complete"
        ? { title: "Finished!", body: label ?? "That's another one for the diary." }
        : { title: "Logged", body: label ?? "Added to your history." };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[61] flex justify-center px-4 lg:bottom-10" role="status" aria-live="polite">
      <div className="rise pointer-events-auto flex items-center gap-3 rounded-2xl border border-purple/50 bg-elevated/95 px-4 py-3 shadow-glow backdrop-blur">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-purple/20 text-glow">
          {kind === "badge" ? <IconTrophy size={18} /> : <IconCheckCircle size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{copy.title}</p>
          <p className="truncate text-xs text-muted">{copy.body}</p>
        </div>
      </div>
    </div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [burst, setBurst] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: Kind; label?: string } | null>(null);
  const seed = useRef(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const celebrate = useCallback((kind: Kind = "watch", label?: string) => {
    seed.current += 1;
    setToast({ kind, label });
    if (!reduced) setBurst(seed.current);
  }, [reduced]);

  const value = { celebrate };

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {burst != null ? <Burst key={burst} seed={burst} onDone={() => setBurst(null)} /> : null}
      {toast ? <Toast key={`${toast.kind}-${toast.label}`} kind={toast.kind} label={toast.label} onDone={() => setToast(null)} /> : null}
    </CelebrationContext.Provider>
  );
}
