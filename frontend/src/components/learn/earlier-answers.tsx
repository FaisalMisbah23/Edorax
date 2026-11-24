"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { History, Sparkles } from "lucide-react";
import type { EarlierAnswersChapter } from "@/shared/api/chapters";
import { loadEarlierAnswers } from "@/server/actions/earlier-answers";

type Status = "idle" | "loading" | "ready" | "error";
type Ctx = { chapters: EarlierAnswersChapter[]; status: Status; ensureLoaded: () => void };

const EarlierAnswersContext = createContext<Ctx | null>(null);

/** Loads the learner's earlier answers once, the first time something asks for them. */
export function EarlierAnswersProvider({ chapterId, children }: { chapterId: string; children: ReactNode }) {
  const [chapters, setChapters] = useState<EarlierAnswersChapter[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const started = useRef(false);

  const ensureLoaded = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setStatus("loading");
    loadEarlierAnswers(chapterId)
      .then((result) => {
        if (result.ok) {
          setChapters(result.data.chapters);
          setStatus("ready");
        } else {
          started.current = false;
          setStatus("error");
        }
      })
      .catch(() => {
        started.current = false;
        setStatus("error");
      });
  }, [chapterId]);

  const value = useMemo(() => ({ chapters, status, ensureLoaded }), [chapters, status, ensureLoaded]);
  return <EarlierAnswersContext.Provider value={value}>{children}</EarlierAnswersContext.Provider>;
}

function useEarlierAnswers() {
  return useContext(EarlierAnswersContext);
}

const popupClass =
  "z-50 rounded-lg bg-popover p-3 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none";

function AnswerList({ chapters, emptyText }: { chapters: EarlierAnswersChapter[]; emptyText: string }) {
  if (chapters.length === 0) return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-4">
      {chapters.map((chapter) => (
        <section key={chapter.chapterId}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{chapter.chapterTitle}</h3>
          <ul className="mt-2 space-y-3">
            {chapter.answers.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <p className="text-xs font-medium text-foreground">{item.question}</p>
                <p className="mt-1 whitespace-pre-wrap border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">
                  {item.answer}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function statusText(status: Status): string {
  if (status === "error") return "Could not load your answers. Try again in a moment.";
  if (status === "idle" || status === "loading") return "Loading your answers...";
  return "You have not answered anything in earlier chapters yet.";
}

/** Header button: opens every question and answer the learner submitted before this chapter. */
export function EarlierAnswersButton() {
  const context = useEarlierAnswers();
  if (!context) return null;
  const { chapters, status, ensureLoaded } = context;
  return (
    <PopoverPrimitive.Root onOpenChange={(open) => open && ensureLoaded()}>
      <PopoverPrimitive.Trigger
        title="See your earlier answers"
        aria-label="See your earlier answers"
        onMouseEnter={ensureLoaded}
        onFocus={ensureLoaded}
        className="inline-flex size-8 items-center justify-center rounded-[8px] text-muted-foreground/70 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        <History className="size-4 shrink-0" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={16} className="isolate z-50 outline-none">
          <PopoverPrimitive.Popup className={`${popupClass} max-h-[min(28rem,70vh)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto`}>
            <PopoverPrimitive.Title className="text-sm font-semibold">Your earlier answers</PopoverPrimitive.Title>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">What you wrote in earlier chapters, newest chapter last.</p>
            <AnswerList chapters={chapters} emptyText={statusText(status)} />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Shown under a question that was written from the learner's earlier answers. Each chapter
 * name is a hover card with the answers the question drew on.
 */
export function PersonalizedNote({ basedOn }: { basedOn: Array<{ chapterSlug: string; chapterTitle: string }> }) {
  const context = useEarlierAnswers();
  const chapters = context?.chapters ?? [];
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Sparkles className="size-3 shrink-0" aria-hidden />
      <span>Written from your earlier answers in</span>
      {basedOn.map((source, index) => {
        const match = chapters.filter((chapter) => chapter.chapterSlug === source.chapterSlug);
        return (
          <PreviewCardPrimitive.Root key={source.chapterSlug} onOpenChange={(open) => open && context?.ensureLoaded()}>
            <PreviewCardPrimitive.Trigger
              render={<button type="button" />}
              className="rounded font-medium text-foreground underline decoration-dotted underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
            >
              {source.chapterTitle}
              {index < basedOn.length - 1 ? "," : ""}
            </PreviewCardPrimitive.Trigger>
            <PreviewCardPrimitive.Portal>
              <PreviewCardPrimitive.Positioner side="top" sideOffset={6} collisionPadding={16} className="isolate z-50 outline-none">
                <PreviewCardPrimitive.Popup className={`${popupClass} max-h-72 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto`}>
                  <AnswerList chapters={match} emptyText={statusText(context?.status ?? "idle")} />
                </PreviewCardPrimitive.Popup>
              </PreviewCardPrimitive.Positioner>
            </PreviewCardPrimitive.Portal>
          </PreviewCardPrimitive.Root>
        );
      })}
    </p>
  );
}
