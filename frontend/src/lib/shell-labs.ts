// Shell labs as the website shows them: the public catalogue, with no checks or solutions.
// The same data comes from GET /api/v1/shell-labs/public, so it works before sign-in.

export interface PublicShellLabStep {
  id: string;
  goal: string;
}

export interface PublicShellLab {
  slug: string;
  topic: string;
  level: string;
  title: string;
  summary: string;
  minutes: number;
  scenario: string | null;
  tags: string[];
  steps: PublicShellLabStep[];
}

const TOPIC_LABEL: Record<string, string> = {
  linux: "Linux",
  docker: "Docker",
  ansible: "Ansible",
  kubernetes: "Kubernetes",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
};

function capitalise(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function shellTopicLabel(topic: string): string {
  return TOPIC_LABEL[topic] ?? capitalise(topic);
}

export function shellLevelLabel(level: string): string {
  return LEVEL_LABEL[level] ?? capitalise(level);
}

/** "Linux · Beginner · 10 min · 4 steps" for the card and the lab page. */
export function shellLabMeta(lab: PublicShellLab): string {
  const parts = [shellTopicLabel(lab.topic), shellLevelLabel(lab.level)];
  if (lab.minutes > 0) parts.push(`${lab.minutes} min`);
  if (lab.steps.length > 0) parts.push(`${lab.steps.length} ${lab.steps.length === 1 ? "step" : "steps"}`);
  return parts.join(" · ");
}
