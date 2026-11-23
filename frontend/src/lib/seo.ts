import type { Metadata } from "next";

// Google shows about 155 characters of a meta description and rewrites ones that are too short
// or too long from text on the page, which on Edorax is often a quiz or demo. Every public page
// therefore gets a description in this range; scripts/seo-audit.mjs checks it on the built site.
export const META_DESCRIPTION_MIN = 120;
export const META_DESCRIPTION_MAX = 160;

/** Robots value for pages that must stay out of search results (sign-in, checkout, invites). */
export const NOINDEX: Metadata["robots"] = { index: false, follow: true };

const CLAUSE_BREAKS = [": ", "; ", ", and ", ", then ", ", but "];

function cutToFit(sentence: string): string {
  const max = META_DESCRIPTION_MAX - 1;
  const earliest = 80;
  const clauseAt = (marks: string[]) =>
    marks.reduce((best, mark) => {
      const at = sentence.lastIndexOf(mark, max);
      return at >= earliest && at > best ? at : best;
    }, -1);
  const clause = clauseAt(CLAUSE_BREAKS);
  const at = clause >= 0 ? clause : clauseAt([", "]);
  if (at >= 0) return `${sentence.slice(0, at).trim()}.`;
  const word = sentence.lastIndexOf(" ", max - 1);
  return `${sentence.slice(0, word > 0 ? word : max - 1).replace(/[,;:]$/, "")}…`;
}

/**
 * Builds a meta description of 120 to 160 characters from longer or shorter text: whole
 * sentences that fit, then the extra sentences in order until the text is long enough. A leading
 * byline ("By Name.") is dropped so the description starts with what the page is about.
 */
export function fitDescription(text: string | null | undefined, extras: string[] = []): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim().replace(/^By [^.]*\.\s+/, "");
  const sentences = clean ? clean.split(/(?<=[.!?])\s+/) : [];
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > META_DESCRIPTION_MAX) break;
    out = next;
  }
  if (!out && sentences[0]) out = cutToFit(sentences[0]);
  for (const extra of extras) {
    if (out.length >= META_DESCRIPTION_MIN) break;
    const next = out ? `${out} ${extra}` : extra;
    if (next.length <= META_DESCRIPTION_MAX) out = next;
  }
  return out;
}
