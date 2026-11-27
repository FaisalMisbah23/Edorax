import Link from "next/link";

/** Waiting and Reviewed views of Answers to check; keeps the course and learner filters when switching. */
export function ReviewTabs({
  active,
  courseId,
  learnerId,
  waitingCount,
}: {
  active: "waiting" | "reviewed";
  courseId?: string;
  learnerId?: string;
  waitingCount?: number;
}) {
  const hrefFor = (status: "waiting" | "reviewed") => {
    const params = new URLSearchParams();
    if (courseId) params.set("courseId", courseId);
    if (learnerId) params.set("learnerId", learnerId);
    if (status === "reviewed") params.set("status", "reviewed");
    return params.size ? `/review?${params}` : "/review";
  };
  const tabs = [
    { key: "waiting" as const, label: waitingCount === undefined ? "Waiting for you" : `Waiting for you (${waitingCount})` },
    { key: "reviewed" as const, label: "Reviewed" },
  ];
  return (
    <nav aria-label="Answers status" className="mt-4 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={hrefFor(tab.key)}
          aria-current={active === tab.key ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium sm:h-9 sm:min-h-0 ${
            active === tab.key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/50"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
