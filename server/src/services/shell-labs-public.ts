// The part of a shell lab the website may show before anyone signs in. Pure, so it is easy to test.

export type PublicShellLabStep = { id: string; goal: string };

export type PublicShellLab = {
  slug: string;
  topic: string;
  level: string;
  title: string;
  summary: string;
  minutes: number;
  scenario: string | null;
  tags: string[];
  /** Only the goal of each step. Checks, hints, solutions and quiz answers stay in the signed-in API. */
  steps: PublicShellLabStep[];
};

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/** Strips a published lab down to the parts that are safe to show to everyone. */
export function toPublicShellLab(lab: Record<string, unknown>): PublicShellLab {
  const steps = Array.isArray(lab.steps) ? (lab.steps as Record<string, unknown>[]) : [];
  return {
    slug: asText(lab.slug),
    topic: asText(lab.topic),
    level: asText(lab.level),
    title: asText(lab.title),
    summary: asText(lab.summary),
    minutes: typeof lab.minutes === "number" ? lab.minutes : 0,
    scenario: asText(lab.scenario) || null,
    tags: Array.isArray(lab.tags) ? lab.tags.filter((tag): tag is string => typeof tag === "string") : [],
    steps: steps.map((step) => ({ id: asText(step.id), goal: asText(step.goal) })).filter((step) => step.id && step.goal),
  };
}
