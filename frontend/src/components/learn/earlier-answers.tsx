"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, History, Sparkles } from "lucide-react";
import type { PersonalizedReference } from "@/shared/api/blocks";
import { splitAnswerReferences } from "@/shared/lib/answer-references";
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

const markClass =
  "inline cursor-help rounded-[4px] bg-brand-yellow/20 px-1 py-px font-semibold text-foreground underline decoration-brand-yellow decoration-2 underline-offset-2 transition-colors outline-none hover:bg-brand-yellow/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow data-popup-open:bg-brand-yellow/35";

/**
 * Words in a question that point back to something the learner wrote. Highlighted like a
 * marker pen; hover, focus or a click opens a card with the question, the full answer and a
 * link to the chapter. The card is a popover so it works with touch and the keyboard.
 */
export function AnswerReference({ reference, children, className }: { reference: PersonalizedReference; children: ReactNode; className?: string }) {
  const params = useParams<{ courseSlug?: string }>();
  const href = params?.courseSlug ? `/courses/${params.courseSlug}/${reference.chapterSlug}` : null;
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger openOnHover delay={120} closeDelay={150} className={`${markClass} ${className ?? ""}`}>
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="top" align="start" sideOffset={8} collisionPadding={16} className="isolate z-50 outline-none">
          <PopoverPrimitive.Popup className={`${popupClass} w-[min(22rem,calc(100vw-2rem))]`}>
            <PopoverPrimitive.Title className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              You wrote in {reference.chapterTitle}
            </PopoverPrimitive.Title>
            <p className="mt-2 text-xs text-muted-foreground">{reference.question}</p>
            <blockquote className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap border-l-2 border-brand-yellow pl-3 text-sm leading-6 text-foreground">
              {reference.answer}
            </blockquote>
            {href ? (
              <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2 hover:text-primary">
                Open that chapter <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** The rewritten question with every [[a1|words]] marker turned into a highlighted reference. */
export function PersonalizedPromptText({ prompt, references }: { prompt: string; references: PersonalizedReference[] }) {
  const byKey = new Map(references.map((reference) => [reference.key, reference]));
  return (
    <>
      {splitAnswerReferences(prompt).map((segment, index) => {
        if (segment.type === "text") return <span key={index}>{segment.text}</span>;
        const reference = byKey.get(segment.key);
        return reference ? (
          <AnswerReference key={index} reference={reference}>
            {segment.text}
          </AnswerReference>
        ) : (
          <span key={index}>{segment.text}</span>
        );
      })}
    </>
  );
}

function shorten(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Under a personalized question. When the wording was rewritten it explains the highlights;
 * when the authored question is shown it offers the learner's related earlier answers as chips.
 */
export function PersonalizedNote({ rewritten, references }: { rewritten: boolean; references: PersonalizedReference[] }) {
  if (references.length === 0) return null;
  if (rewritten) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3 shrink-0" aria-hidden />
        Written from your earlier answers. Hover or tap a highlighted phrase to see what you wrote.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <History className="size-3 shrink-0" aria-hidden />
        Your earlier answers that connect here:
      </span>
      {references.map((reference) => (
        <AnswerReference key={reference.key} reference={reference} className="max-w-[16rem] truncate align-middle text-xs font-medium">
          {shorten(reference.answer, 40)}
        </AnswerReference>
      ))}
    </div>
  );
}
