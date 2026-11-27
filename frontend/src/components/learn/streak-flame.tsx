import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The flame changes look as the streak grows, so each milestone is easy to tell apart:
 *   0      gray outline, still
 *   1-2    plain red outline, calm sway
 *   3-6    same, plus little flames that rise off the fire and fade
 *   7-13   hot: filled orange and red, red glow, flicker
 *   14-29  blazing: deeper red, yellow core
 *   30-59  inferno: orange and yellow flame, yellow and white core, more little flames
 *   60-99  gold: golden flame with a pale core
 *   100-364 blue: the hottest fire, blue with a white core
 *   365+   legend: violet and pink with a white core and matching little flames
 * Every animation is behind motion-safe, so it stops for people who turn motion off.
 */
export type StreakTier = "cold" | "spark" | "lit" | "hot" | "blazing" | "inferno" | "gold" | "blue" | "legend";

export function streakTier(days: number): StreakTier {
  if (days >= 365) return "legend";
  if (days >= 100) return "blue";
  if (days >= 60) return "gold";
  if (days >= 30) return "inferno";
  if (days >= 14) return "blazing";
  if (days >= 7) return "hot";
  if (days >= 3) return "lit";
  if (days >= 1) return "spark";
  return "cold";
}

type TierLook = {
  outer: string;
  glow: string;
  motion: string;
  /** Number of little flames rising off the fire. */
  sparks: number;
  sparkClass: string;
  core?: string;
  /** A second, smaller core on top of the first. */
  innerCore?: string;
  /** Text color for numbers shown next to this flame. */
  accent: string;
};

const LOOKS: Record<StreakTier, TierLook> = {
  cold: { outer: "text-muted-foreground/60", glow: "", motion: "", sparks: 0, sparkClass: "", accent: "text-muted-foreground" },
  spark: {
    outer: "text-red-500",
    glow: "",
    motion: "motion-safe:animate-[streak-sway_2.8s_ease-in-out_infinite]",
    sparks: 0,
    sparkClass: "",
    accent: "text-red-500",
  },
  lit: {
    outer: "text-red-500",
    glow: "",
    motion: "motion-safe:animate-[streak-sway_2s_ease-in-out_infinite]",
    sparks: 3,
    sparkClass: "fill-orange-500 text-red-500",
    accent: "text-red-500",
  },
  hot: {
    outer: "text-red-500 fill-orange-500",
    glow: "drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]",
    motion: "motion-safe:animate-[streak-flicker_1.8s_ease-in-out_infinite]",
    sparks: 3,
    sparkClass: "fill-orange-500 text-red-500",
    accent: "text-red-500",
  },
  blazing: {
    outer: "text-red-600 fill-red-500",
    glow: "drop-shadow-[0_0_8px_rgba(239,68,68,0.85)]",
    motion: "motion-safe:animate-[streak-flicker_1.3s_ease-in-out_infinite]",
    sparks: 4,
    sparkClass: "fill-orange-400 text-red-500",
    core: "fill-yellow-400 text-yellow-400",
    accent: "text-red-600",
  },
  inferno: {
    outer: "text-orange-500 fill-orange-400",
    glow: "drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]",
    motion: "motion-safe:animate-[streak-flicker_1.1s_ease-in-out_infinite]",
    sparks: 5,
    sparkClass: "fill-yellow-400 text-orange-500",
    core: "fill-yellow-300 text-yellow-300",
    innerCore: "fill-white text-white",
    accent: "text-orange-500",
  },
  gold: {
    outer: "text-amber-500 fill-amber-400",
    glow: "drop-shadow-[0_0_12px_rgba(245,158,11,0.95)]",
    motion: "motion-safe:animate-[streak-flicker_1.2s_ease-in-out_infinite]",
    sparks: 6,
    sparkClass: "fill-yellow-300 text-amber-500",
    core: "fill-yellow-200 text-yellow-200",
    innerCore: "fill-white text-white",
    accent: "text-amber-500",
  },
  blue: {
    outer: "text-blue-500 fill-sky-400",
    glow: "drop-shadow-[0_0_12px_rgba(59,130,246,0.95)]",
    motion: "motion-safe:animate-[streak-flicker_1s_ease-in-out_infinite]",
    sparks: 6,
    sparkClass: "fill-sky-300 text-blue-500",
    core: "fill-cyan-200 text-cyan-200",
    innerCore: "fill-white text-white",
    accent: "text-blue-500",
  },
  legend: {
    outer: "text-violet-500 fill-fuchsia-400",
    glow: "drop-shadow-[0_0_14px_rgba(168,85,247,0.95)]",
    motion: "motion-safe:animate-[streak-flicker_0.9s_ease-in-out_infinite]",
    sparks: 7,
    sparkClass: "fill-fuchsia-400 text-violet-500",
    core: "fill-pink-200 text-pink-200",
    innerCore: "fill-white text-white",
    accent: "text-violet-500",
  },
};

/** Halo color (rgb) and little-flame classes that match a streak's flame, for the milestone celebration. */
const HALO: Record<StreakTier, string> = {
  cold: "148,163,184",
  spark: "239,68,68",
  lit: "239,68,68",
  hot: "249,115,22",
  blazing: "239,68,68",
  inferno: "249,115,22",
  gold: "245,158,11",
  blue: "59,130,246",
  legend: "168,85,247",
};

export function streakHaloRgb(days: number) {
  return HALO[streakTier(days)];
}

export function streakSparkClass(days: number) {
  return LOOKS[streakTier(days)].sparkClass || "fill-orange-500 text-red-500";
}

/** Text color that matches a streak's flame. */
export function streakAccentClass(days: number) {
  return LOOKS[streakTier(days)].accent;
}

const SPARKS = [
  { left: "12%", delay: "0s" },
  { left: "40%", delay: "-0.6s" },
  { left: "64%", delay: "-1.2s" },
  { left: "26%", delay: "-0.3s" },
  { left: "52%", delay: "-0.9s" },
  { left: "76%", delay: "-1.5s" },
  { left: "34%", delay: "-1.7s" },
];

export function StreakFlame({
  days,
  className,
  sparks = true,
}: {
  days: number;
  className?: string;
  /** Little flames rising off the main flame. Turn off where other flames already fill the space. */
  sparks?: boolean;
}) {
  const tier = streakTier(days);
  const look = LOOKS[tier];
  return (
    <span
      className={cn("relative inline-flex size-4 shrink-0 origin-bottom items-center justify-center", look.motion, className)}
      data-streak-tier={tier}
      aria-hidden
    >
      <Flame className={cn("size-full", look.outer, look.glow)} strokeWidth={2} />
      {SPARKS.slice(0, sparks ? look.sparks : 0).map((spark) => (
        <Flame
          key={spark.left}
          aria-hidden
          className={cn(
            "absolute bottom-[55%] size-[26%] opacity-0 motion-reduce:hidden motion-safe:animate-[streak-rise_1.8s_ease-out_infinite]",
            look.sparkClass
          )}
          style={{ left: spark.left, animationDelay: spark.delay }}
          strokeWidth={2.5}
        />
      ))}
      {look.core ? (
        <Flame
          className={cn("absolute bottom-[8%] size-[52%] origin-bottom motion-safe:animate-[streak-core_1.1s_ease-in-out_infinite]", look.core)}
          strokeWidth={2.5}
        />
      ) : null}
      {look.innerCore ? (
        <Flame
          className={cn("absolute bottom-[10%] size-[28%] origin-bottom motion-safe:animate-[streak-core_0.8s_ease-in-out_infinite]", look.innerCore)}
          strokeWidth={2.5}
        />
      ) : null}
    </span>
  );
}
