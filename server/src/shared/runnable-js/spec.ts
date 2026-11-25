/**
 * Contract for the runnable JavaScript example (the ```js run fence in a lesson).
 *
 * The author writes a normal JavaScript fence and adds the word run after the
 * language:
 *
 *   ```js run
 *   console.log("Hello");
 *   ```
 *
 * The reader draws it as a small editor with a Run button. The code runs in the
 * learner's browser only, inside a Web Worker, and nothing is sent anywhere. A
 * plain ```js fence stays a read-only code block. This file is pure: the remark
 * plugin, the source checks and the component all use it, so they agree on what
 * a runnable example is.
 */

/** Longest example, in characters. Anything longer belongs in a graded exercise. */
export const RUNNABLE_JS_MAX_SOURCE = 4000;
/** An example that runs longer than this is stopped. */
export const RUNNABLE_JS_TIME_LIMIT_MS = 2000;
/** Output lines kept per run. */
export const RUNNABLE_JS_MAX_LINES = 200;
/** Characters kept per output line. */
export const RUNNABLE_JS_MAX_LINE_LENGTH = 500;

const LANGUAGES = new Set(["js", "javascript"]);

/**
 * True when a code fence is a runnable example: language js or javascript, and
 * the word run in the rest of the info string. A fence with no run word is not.
 */
export function isRunnableJsFence(lang: string | null | undefined, meta: string | null | undefined): boolean {
  if (!lang || !LANGUAGES.has(lang.toLowerCase())) return false;
  return (meta ?? "").split(/\s+/).some((word) => word === "run");
}

/** The example source, or an error naming what the author must fix. */
export function parseRunnableJsFence(value: string): string {
  const code = value.replace(/\s+$/, "");
  if (!code.trim()) throw new Error("A ```js run fence needs some code.");
  if (code.length > RUNNABLE_JS_MAX_SOURCE) {
    throw new Error(`A \`\`\`js run fence can hold at most ${RUNNABLE_JS_MAX_SOURCE} characters. Use a graded code exercise for longer code.`);
  }
  return code;
}
