"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ClassTabPanel = { key: string; label: string; node: ReactNode };

// All panels stay mounted so a half-edited due date survives a switch of tab.
export function ClassTabs({ panels }: { panels: ClassTabPanel[] }) {
  const [active, setActive] = useState(panels[0]?.key ?? "");

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Class sections" className="flex gap-1 overflow-x-auto border-b">
        {panels.map((panel) => {
          const selected = panel.key === active;
          return (
            <button
              key={panel.key}
              type="button"
              role="tab"
              id={`class-tab-${panel.key}`}
              aria-selected={selected}
              aria-controls={`class-panel-${panel.key}`}
              onClick={() => setActive(panel.key)}
              className={cn(
                "-mb-px inline-flex h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {panel.label}
            </button>
          );
        })}
      </div>
      {panels.map((panel) => (
        <div key={panel.key} role="tabpanel" id={`class-panel-${panel.key}`} aria-labelledby={`class-tab-${panel.key}`} hidden={panel.key !== active}>
          {panel.node}
        </div>
      ))}
    </div>
  );
}
