"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CourseSettingsView } from "@/shared/api/teach";
import { cn } from "@/lib/utils";
import { CourseAiGradingSummary, CourseSettings, type CourseSettingsDirty } from "./course-settings";

// Course settings in tabs, one topic on screen at a time instead of one long page.
// Every panel stays mounted, so an unsaved edit survives a tab switch; a dot on the
// tab says it has unsaved changes. The tab is kept in the address (#pricing) so a
// link can open the page on the right tab.

type TabId = "details" | "learning" | "ai" | "pricing" | "certificate" | "integrity" | "team";

/** Tab ids plus the section ids the page used before it had tabs, so old links still land. */
const HASH_TO_TAB: Record<string, TabId> = {
  details: "details",
  "course-details": "details",
  learning: "learning",
  "learning-rules": "learning",
  ai: "ai",
  "ai-grading": "ai",
  pricing: "pricing",
  "course-coupons": "pricing",
  certificate: "certificate",
  integrity: "integrity",
  "quiz-integrity": "integrity",
  team: "team",
  "course-team": "team",
};

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function CourseSettingsTabs({
  course,
  certificate,
  integrity,
  coupons,
  team,
}: {
  course: CourseSettingsView;
  certificate: ReactNode;
  integrity: ReactNode;
  /** Only for paid courses; shown under Pricing. */
  coupons: ReactNode;
  team: ReactNode;
}) {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1), () => "");
  // The address is the one source of truth for the tab; this only asks for a re-read after a click.
  const [, setClicks] = useState(0);
  const [dirty, setDirty] = useState<CourseSettingsDirty>({ details: false, learning: false, pricing: false });
  const onDirtyChange = useCallback((next: CourseSettingsDirty) => setDirty(next), []);

  const tabs: Array<{ id: TabId; label: string; unsaved?: boolean }> = [
    { id: "details", label: "Details", unsaved: dirty.details },
    { id: "learning", label: "Learning", unsaved: dirty.learning },
    ...(course.aiGrading ? [{ id: "ai" as const, label: "AI grading" }] : []),
    { id: "pricing", label: "Pricing", unsaved: dirty.pricing },
    { id: "certificate", label: "Certificate" },
    { id: "integrity", label: "Quiz camera" },
    { id: "team", label: "Team" },
  ];
  const wanted = HASH_TO_TAB[hash] ?? "details";
  const active = tabs.some((tab) => tab.id === wanted) ? wanted : "details";

  function choose(id: TabId) {
    window.history.replaceState(null, "", `#${id}`);
    setClicks((count) => count + 1);
  }

  // On a phone the tab row scrolls sideways; keep the open tab in view.
  useEffect(() => {
    document.getElementById(`settings-tab-${active}`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  const formSection = active === "details" || active === "learning" || active === "pricing" ? active : null;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Course settings" className="-mx-4 flex gap-1.5 overflow-x-auto border-b px-4 pb-px [scrollbar-width:none] sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`settings-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            onClick={() => choose(tab.id)}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              active === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.unsaved ? <span className="size-1.5 rounded-full bg-amber-500" aria-label="unsaved changes" /> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`settings-panel-${formSection ?? "details"}`} aria-labelledby={`settings-tab-${formSection ?? "details"}`} hidden={formSection === null}>
        <CourseSettings key={course.id} course={course} section={formSection} onDirtyChange={onDirtyChange} />
      </div>
      {formSection === "pricing" ? coupons : null}
      <Panel id="ai" active={active}><CourseAiGradingSummary course={course} /></Panel>
      <Panel id="certificate" active={active}>{certificate}</Panel>
      <Panel id="integrity" active={active}>{integrity}</Panel>
      <Panel id="team" active={active}>{team}</Panel>
    </div>
  );
}

function Panel({ id, active, children }: { id: TabId; active: TabId; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`settings-panel-${id}`} aria-labelledby={`settings-tab-${id}`} hidden={active !== id}>
      {children}
    </div>
  );
}
