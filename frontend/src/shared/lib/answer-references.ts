// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
// A personalized question marks each place it refers to something the learner wrote earlier
// as [[a1|their words]]. "a1" names one earlier answer; the reader turns the span into a
// highlighted reference with a card showing the full answer. Text without markers is plain.

const MARKER = /\[\[(a\d{1,2})\|([^\][\n]{1,200})\]\]/g;

export type PromptSegment = { type: "text"; text: string } | { type: "ref"; key: string; text: string };

/** The prompt cut into plain text and reference spans, in reading order. */
export function splitAnswerReferences(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let last = 0;
  for (const match of prompt.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: prompt.slice(last, start) });
    segments.push({ type: "ref", key: match[1]!, text: match[2]!.trim() });
    last = start + match[0].length;
  }
  if (last < prompt.length) segments.push({ type: "text", text: prompt.slice(last) });
  return segments;
}

/** The prompt as plain text, markers replaced by the words inside them. */
export function stripAnswerReferences(prompt: string): string {
  return prompt.replace(MARKER, (_all, _key: string, text: string) => text.trim());
}

/** Keep only markers whose key is known; any other marker (or a stray bracket pair) becomes plain words. */
export function keepKnownReferences(prompt: string, knownKeys: ReadonlySet<string>): string {
  return prompt.replace(MARKER, (all, key: string, text: string) => (knownKeys.has(key) ? all : text.trim()));
}

/** Keys of the markers that appear in the prompt, once each, in order. */
export function referencedKeys(prompt: string): string[] {
  return [...new Set([...prompt.matchAll(MARKER)].map((match) => match[1]!))];
}
