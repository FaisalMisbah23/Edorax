import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The flame grows with the streak:
 * 0 = gray outline (still), 1-2 = plain red outline with a calm sway,
 * 3-6 = the same plus little flames that rise off the fire and fade,
 * 7-13 = hot (filled, glow, flicker, rising little flames), 14+ = blazing (adds a flickering yellow core).
 * Every animation is behind motion-safe, so it stops for people who turn motion off.
 * Colors are a red and orange fire with a yellow core, so light and dark both work.
 */
export type StreakTier = "cold" | "spark" | "lit" | "hot" | "blazing";

export function streakTier(days: number): StreakTier {
  if (days >= 14) return "blazing";
  if (days >= 7) return "hot";
  if (days >= 3) return "lit";
  if (days >= 1) return "spark";
  return "cold";
}

const OUTER: Record<StreakTier, string> = {
  cold: "text-muted-foreground/60",
  spark: "text-red-500",
  lit: "text-red-500",
  hot: "text-red-500 fill-orange-500",
  blazing: "text-red-600 fill-red-500",
};

const GLOW: Record<StreakTier, string> = {
  cold: "",
  spark: "",
  lit: "",
  hot: "drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]",
  blazing: "drop-shadow-[0_0_8px_rgba(239,68,68,0.85)]",
};

const SPARKS = [
  { left: "12%", delay: "0s" },
  { left: "40%", delay: "-0.6s" },
  { left: "64%", delay: "-1.2s" },
];

const MOTION: Record<StreakTier, string> = {
  cold: "",
  spark: "motion-safe:animate-[streak-sway_2.8s_ease-in-out_infinite]",
  lit: "motion-safe:animate-[streak-sway_2s_ease-in-out_infinite]",
  hot: "motion-safe:animate-[streak-flicker_1.8s_ease-in-out_infinite]",
  blazing: "motion-safe:animate-[streak-flicker_1.2s_ease-in-out_infinite]",
};

export function StreakFlame({ days, className }: { days: number; className?: string }) {
  const tier = streakTier(days);
  const hasCore = tier === "hot" || tier === "blazing";
  // From day 3, little flames rise off the fire and fade out.
  const hasSparks = tier === "lit" || tier === "hot" || tier === "blazing";
  return (
    <span
      className={cn("relative inline-flex size-4 shrink-0 origin-bottom items-center justify-center", MOTION[tier], className)}
      data-streak-tier={tier}
      aria-hidden
    >
      <Flame className={cn("size-full", OUTER[tier], GLOW[tier])} strokeWidth={2} />
      {hasSparks ? (
        <>
          {SPARKS.map((spark) => (
            <Flame
              key={spark.left}
              aria-hidden
              className="absolute bottom-[55%] size-[26%] fill-orange-500 text-red-500 opacity-0 motion-reduce:hidden motion-safe:animate-[streak-rise_1.8s_ease-out_infinite]"
              style={{ left: spark.left, animationDelay: spark.delay }}
              strokeWidth={2.5}
            />
          ))}
        </>
      ) : null}
      {hasCore ? (
        <Flame
          className="absolute bottom-[8%] size-[52%] origin-bottom fill-brand-yellow text-brand-yellow motion-safe:animate-[streak-core_1.1s_ease-in-out_infinite]"
          strokeWidth={2.5}
        />
      ) : null}
    </span>
  );
}
