"use client";

// Where a lab's tests live, on every kind of board (system design, networking) and
// every surface that shows one (home page, Labs, a course chapter, the instructor
// preview, the desktop app, inline or full screen). The tests are never below the
// board, so nobody scrolls to find them.
//
// - Closed: a tab on the right edge of the board. It carries the score.
// - Open on a phone-sized board (under 42rem): a sheet that rises from the bottom,
//   so the board stays in view above it.
// - Open on a small board (42rem up): a drawer that slides in from the right.
// - From `columnFrom` up: a column of the board's grid, beside the board.
//
// The dock only places the panel. The board it sits in must be a container
// (`@container`), and the dock's parent must be positioned (`relative`) and, from
// `columnFrom` up, a grid with a column for it.

import type { ReactNode } from "react";

/** The container width from which the open panel is a column beside the board: 56rem or 72rem. */
export type TestsDockColumnFrom = "4xl" | "6xl";
export type TestsDockTone = "idle" | "pass" | "fail";

const TESTS_DOCK_CSS = `
@keyframes lab-sheet-in { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes lab-drawer-in { from { transform: translateX(28px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.lab-dock-in { animation: lab-sheet-in 0.22s cubic-bezier(.2,.85,.25,1) both; }
@container (min-width: 42rem) { .lab-dock-in { animation-name: lab-drawer-in; } }
/* Where the tests are a column of the board, nothing slides. */
@container (min-width: 56rem) { .lab-dock-in.lab-dock-from-4xl { animation: none; } }
@container (min-width: 72rem) { .lab-dock-in.lab-dock-from-6xl { animation: none; } }
@media (prefers-reduced-motion: reduce) { .lab-dock-in { animation: none; } }
`;

const PANEL_BASE = "custom-scrollbar min-h-0 overflow-y-auto border-border bg-card";
// Over the board: a bottom sheet under 42rem, a right-hand drawer from 42rem.
const PANEL_OVER = `${PANEL_BASE} absolute bottom-0 left-0 right-0 z-30 max-h-[56%] rounded-t-[14px] border-t-[1.5px] shadow-[0_-14px_32px_-14px_rgba(15,23,42,0.45)] @2xl:left-auto @2xl:top-0 @2xl:max-h-none @2xl:w-[min(370px,calc(100%-40px))] @2xl:rounded-none @2xl:border-l-[1.5px] @2xl:border-t-0 @2xl:shadow-[-14px_0_32px_-14px_rgba(15,23,42,0.45)]`;
const PANEL: Record<TestsDockColumnFrom, string> = {
  "4xl": `${PANEL_OVER} lab-dock-from-4xl @4xl:static @4xl:z-auto @4xl:w-auto @4xl:shadow-none`,
  "6xl": `${PANEL_OVER} lab-dock-from-6xl @6xl:static @6xl:z-auto @6xl:w-auto @6xl:shadow-none`,
};
/** Hides the panel below `columnFrom`, where the tab stands in for it. */
const PANEL_COLUMN_ONLY: Record<TestsDockColumnFrom, string> = { "4xl": "hidden @4xl:block", "6xl": "hidden @6xl:block" };
/** Hides the tab from `columnFrom` up, where the panel is a column. */
const TAB_BELOW_COLUMN: Record<TestsDockColumnFrom, string> = { "4xl": "@4xl:hidden", "6xl": "@6xl:hidden" };

const TAB_EDGE = "absolute right-0 top-1/2 z-20 -translate-y-1/2";
// A wide board can show the closed panel as a slim rail of its grid instead of a floating tab.
const TAB_RAIL = `${TAB_EDGE} @6xl:static @6xl:h-full @6xl:translate-y-0 @6xl:border-l-[1.5px] @6xl:border-border @6xl:bg-muted/55`;
const TAB_BUTTON = "flex flex-col items-center gap-2 rounded-l-[8px] border-[1.5px] border-r-0 border-border bg-card px-1.5 py-3 text-muted-foreground shadow-[-4px_3px_12px_-4px_rgba(15,23,42,0.35)] hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground";
const TAB_BUTTON_RAIL = `${TAB_BUTTON} @6xl:h-full @6xl:w-full @6xl:justify-center @6xl:rounded-none @6xl:border-0 @6xl:bg-transparent @6xl:px-2 @6xl:shadow-none`;

const TONE: Record<TestsDockTone, string> = {
  idle: "bg-muted text-muted-foreground",
  pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  fail: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function TestsDock({
  open,
  columnFrom = "6xl",
  closedAs = "tab",
  label = "Tests",
  panelLabel = "Test suite",
  badge,
  tone = "idle",
  onOpen,
  className = "",
  testId = "tests-dock",
  children,
}: {
  /**
   * true: shown. false: closed to the tab. null: not chosen, so the panel is a column
   * where the board is wide enough (from `columnFrom`) and the tab stands in below that.
   */
  open: boolean | null;
  columnFrom?: TestsDockColumnFrom;
  /** "rail": on a board 72rem or wider the closed panel is a slim rail of the grid. */
  closedAs?: "tab" | "rail";
  /** The word on the tab. */
  label?: string;
  /** The accessible name of the panel. */
  panelLabel?: string;
  /** The score on the tab, for example "3/4". */
  badge: string;
  tone?: TestsDockTone;
  onOpen: () => void;
  /** Extra classes for the panel, for how it looks as a column on this board. */
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  const tab = (extra: string) => (
    <aside className={`${closedAs === "rail" ? TAB_RAIL : TAB_EDGE} ${extra}`} aria-label={`${panelLabel}, closed`} data-testid={`${testId}-tab`}>
      <button
        type="button"
        onClick={onOpen}
        className={closedAs === "rail" ? TAB_BUTTON_RAIL : TAB_BUTTON}
        title={`Open the ${label.toLowerCase()}`}
        aria-label={`Open the ${label.toLowerCase()}`}
        aria-expanded={false}
      >
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] [writing-mode:vertical-rl]">{label}</span>
        <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold ${TONE[tone]}`}>{badge}</span>
      </button>
    </aside>
  );

  const panel = (extra: string) => (
    <aside className={`${PANEL[columnFrom]} ${className} ${extra}`} aria-label={panelLabel} data-testid={testId}>
      {/* The grip of the bottom sheet, shown only where the panel is a sheet. */}
      <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border @2xl:hidden" />
      {children}
    </aside>
  );

  return (
    <>
      <style>{TESTS_DOCK_CSS}</style>
      {open === null ? (
        // The width of the board decides, in CSS, so nothing jumps after the first paint.
        <>
          {tab(TAB_BELOW_COLUMN[columnFrom])}
          {panel(PANEL_COLUMN_ONLY[columnFrom])}
        </>
      ) : open ? (
        panel("lab-dock-in")
      ) : (
        tab("")
      )}
    </>
  );
}

/** The close control for a panel in the dock: a down arrow on the bottom sheet, a right arrow on the drawer or column. */
export function TestsDockClose({ label = "tests", onClose, className = "" }: { label?: string; onClose: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={`flex size-7 shrink-0 items-center justify-center rounded-[5px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}
      title={`Close the ${label}`}
      aria-label={`Close the ${label}`}
    >
      <svg className="size-3.5 rotate-90 @2xl:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
    </button>
  );
}
