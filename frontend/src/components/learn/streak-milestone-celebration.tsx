"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStreakSoundOff, playStreakSound, setStreakSoundOff } from "@/lib/streak-sound";
import { Button } from "@/components/ui/button";
import { StreakFlame, streakAccentClass, streakHaloRgb, streakSparkClass } from "@/components/learn/streak-flame";

const COPY: Record<number, { title: string; line: string }> = {
  3: { title: "3 days in a row", line: "Your fire is lit. Come back tomorrow to keep it going." },
  7: { title: "One full week", line: "7 days in a row. This is how a habit starts." },
  14: { title: "Two weeks strong", line: "14 days in a row. Your fire is getting hot." },
  30: { title: "30 days", line: "A whole month of learning. Your fire is blazing." },
  60: { title: "60 days", line: "Two months. You are in the top of learners who stay." },
  100: { title: "100 days", line: "Very few people get here. Be proud of this one." },
  365: { title: "One year", line: "365 days in a row. That is a real habit." },
};

function copyFor(days: number) {
  return COPY[days] ?? { title: `${days} days in a row`, line: "Keep your fire going." };
}

/** More days, more little flames. */
function particleCount(days: number) {
  if (days >= 30) return 24;
  if (days >= 14) return 18;
  if (days >= 7) return 13;
  return 8;
}

/**
 * Same numbers every time, so server and browser agree.
 * Little flames only rise on the left and right sides of the card, so the middle column
 * (main flame, number, text) stays clear.
 */
function particle(index: number, count: number) {
  const side = index % 2;
  const perSide = Math.ceil(count / 2);
  const fraction = (Math.floor(index / 2) + 0.5) / perSide;
  const wobble = (((index * 37) % 7) - 3) * 0.5;
  return {
    left: `${side ? 78 + fraction * 16 + wobble : 4 + fraction * 16 + wobble}%`,
    size: 14 + ((index * 11) % 4) * 6,
    delay: `${-((index * 0.37) % 2.6)}s`,
    duration: `${2.2 + ((index * 7) % 5) * 0.25}s`,
    dx: `${((index * 53) % 61) - 30}px`,
    rot: `${((index * 29) % 50) - 25}deg`,
  };
}

export function StreakMilestoneCelebration({
  days,
  open,
  onClose,
}: {
  days: number;
  open: boolean;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [soundOff, setSoundOff] = useState(() => isStreakSoundOff());

  // Play the sound once each time the celebration opens.
  useEffect(() => {
    if (!open) return;
    playStreakSound(days);
  }, [open, days]);

  function toggleSound() {
    const next = !soundOff;
    setSoundOff(next);
    setStreakSoundOff(next);
    if (!next) playStreakSound(days);
  }

  useEffect(() => {
    if (!open) return;
    buttonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const { title, line } = copyFor(days);
  const count = particleCount(days);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-milestone-title"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border bg-card p-8 text-center text-card-foreground shadow-xl motion-safe:animate-[streak-pop_0.45s_cubic-bezier(0.2,1.2,0.4,1)]"
      >
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOff ? "Turn sound on" : "Turn sound off"}
          aria-pressed={!soundOff}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {soundOff ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        </button>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4"
          style={{ background: `radial-gradient(ellipse at 50% 70%, rgba(${streakHaloRgb(days)},0.24), transparent 70%)` }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden>
          {Array.from({ length: count }, (_, index) => {
            const p = particle(index, count);
            return (
              <Flame
                key={index}
                className={cn("absolute bottom-[38%] opacity-0 motion-safe:animate-[streak-burst_var(--dur)_ease-out_infinite]", streakSparkClass(days))}
                style={
                  {
                    left: p.left,
                    width: p.size,
                    height: p.size,
                    animationDelay: p.delay,
                    "--dur": p.duration,
                    "--dx": p.dx,
                    "--rot": p.rot,
                  } as React.CSSProperties
                }
                strokeWidth={2.25}
              />
            );
          })}
        </div>

        <div className="relative flex flex-col items-center">
          <StreakFlame days={days} className="size-28" sparks={false} />
          <p className={cn("mt-4 text-5xl font-semibold tabular-nums tracking-tight", streakAccentClass(days))}>{days}</p>
          <h2 id="streak-milestone-title" className="mt-1 text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-2 max-w-[17rem] text-sm leading-6 text-muted-foreground">{line}</p>
          <Button ref={buttonRef} onClick={onClose} size="lg" className="mt-6 w-full">
            Keep going
          </Button>
        </div>
      </div>
    </div>
  );
}
