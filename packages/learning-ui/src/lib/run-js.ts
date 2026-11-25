/**
 * Runs a small JavaScript example in the learner's browser, for the runnable
 * example block (the ```js run fence in a lesson).
 *
 * The code runs in a Web Worker made from a Blob. A worker has no page, so the
 * code cannot reach the DOM, cookies, localStorage or the learner's session. The
 * worker script also removes the network and worker APIs before it runs the
 * example (fetch, XMLHttpRequest, WebSocket and the others), so a lesson example
 * cannot send anything anywhere. After the time limit the worker is terminated,
 * which stops an endless loop. Nothing is sent to the server, graded or stored.
 *
 * The worker is injected (createWorker) so the tests can run the same script in
 * Node and the page can use a real Worker.
 */
import {
  RUNNABLE_JS_MAX_LINES,
  RUNNABLE_JS_MAX_LINE_LENGTH,
  RUNNABLE_JS_TIME_LIMIT_MS,
} from "../shared/runnable-js/spec";

export type OutputLevel = "log" | "warn" | "error";
export type OutputLine = { level: OutputLevel; text: string };

export type RunResult = {
  /** What the code printed, in order. */
  lines: OutputLine[];
  /** A message in plain words when the code threw, ran too long or could not start. */
  error: string | null;
  /** True when the time limit stopped the code. */
  timedOut: boolean;
  /** True when the code printed more than the line cap and the rest was dropped. */
  truncated: boolean;
};

/** The small part of the Worker interface this file uses. */
export type WorkerLike = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
};

export type RunOptions = {
  timeoutMs?: number;
  maxLines?: number;
  maxLineLength?: number;
  createWorker?: (source: string) => WorkerLike;
};

/**
 * The script the worker runs. It is plain JavaScript in a string, not a function
 * that is turned into text, so a build tool cannot rewrite it. It is written for
 * a worker: everything it needs is declared inside it.
 */
export function buildWorkerSource(maxLines: number, maxLineLength: number): string {
  return `(function () {
  "use strict";
  var post = self.postMessage.bind(self);
  var MAX_LINES = ${Math.floor(maxLines)};
  var MAX_LEN = ${Math.floor(maxLineLength)};
  var count = 0;
  var finished = false;
  var origSetTimeout = self.setTimeout.bind(self);
  var origClearTimeout = self.clearTimeout.bind(self);
  var origSetInterval = self.setInterval.bind(self);
  var origClearInterval = self.clearInterval.bind(self);

  function plainKey(key) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : "'" + key + "'";
  }

  function show(value, depth, seen, top) {
    var type = typeof value;
    if (type === "string") return top ? value : "'" + value + "'";
    if (value === null || type === "number" || type === "boolean" || type === "undefined") return String(value);
    if (type === "bigint") return String(value) + "n";
    if (type === "symbol") return value.toString();
    if (type === "function") return "[Function" + (value.name ? ": " + value.name : " (anonymous)") + "]";
    if (value instanceof Error) return (value.name || "Error") + ": " + value.message;
    if (seen.indexOf(value) >= 0) return "[Circular]";
    if (depth > 3) return Array.isArray(value) ? "[Array]" : "[Object]";
    seen.push(value);
    try {
      var parts = [];
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length && i < 100; i++) parts.push(show(value[i], depth + 1, seen, false));
        if (value.length > 100) parts.push("... " + (value.length - 100) + " more items");
        return parts.length ? "[ " + parts.join(", ") + " ]" : "[]";
      }
      if (value instanceof Map) {
        value.forEach(function (v, k) { parts.push(show(k, depth + 1, seen, false) + " => " + show(v, depth + 1, seen, false)); });
        return "Map(" + value.size + ") " + (parts.length ? "{ " + parts.join(", ") + " }" : "{}");
      }
      if (value instanceof Set) {
        value.forEach(function (v) { parts.push(show(v, depth + 1, seen, false)); });
        return "Set(" + value.size + ") " + (parts.length ? "{ " + parts.join(", ") + " }" : "{}");
      }
      if (value instanceof Date) return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
      var keys = Object.keys(value);
      for (var j = 0; j < keys.length && j < 100; j++) {
        parts.push(plainKey(keys[j]) + ": " + show(value[keys[j]], depth + 1, seen, false));
      }
      return parts.length ? "{ " + parts.join(", ") + " }" : "{}";
    } catch (err) {
      return "[Object]";
    } finally {
      seen.pop();
    }
  }

  function line(level, args) {
    if (count >= MAX_LINES) {
      if (count === MAX_LINES) { count++; post({ t: "truncated" }); }
      return;
    }
    count++;
    var texts = [];
    for (var i = 0; i < args.length; i++) texts.push(show(args[i], 0, [], true));
    var text = texts.join(" ");
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN) + "...";
    post({ t: "log", level: level, text: text });
  }

  var fakeConsole = {
    log: function () { line("log", arguments); },
    info: function () { line("log", arguments); },
    debug: function () { line("log", arguments); },
    warn: function () { line("warn", arguments); },
    error: function () { line("error", arguments); },
    table: function () { line("log", arguments); },
    dir: function () { line("log", arguments); },
    clear: function () {}
  };
  Object.defineProperty(self, "console", { value: fakeConsole, configurable: true, writable: true });

  // Take the network and worker APIs away from the global object and its parents
  // (but never Object.prototype, which every learner object shares).
  var blocked = [
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts",
    "Worker", "SharedWorker", "BroadcastChannel", "indexedDB", "caches", "postMessage", "close"
  ];
  var chain = [];
  for (var o = self; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) chain.push(o);
  blocked.forEach(function (name) {
    chain.forEach(function (target) {
      try { Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false }); } catch (e) { /* not defined here */ }
    });
  });

  function finish() {
    if (finished) return;
    finished = true;
    post({ t: "done" });
  }

  function fail(err) {
    if (finished) return;
    var name = "Error";
    var message = "";
    if (err && typeof err === "object" && typeof err.message === "string") {
      name = typeof err.name === "string" ? err.name : "Error";
      message = err.message;
    } else {
      message = String(err);
    }
    finished = true;
    post({ t: "error", name: name, message: message });
  }

  // Count pending timers so the run ends when the code has nothing left to do.
  var pending = 0;
  var live = {};
  function settle() {
    origSetTimeout(function () { if (pending === 0) finish(); }, 0);
  }
  self.setTimeout = function (fn, ms) {
    var extra = Array.prototype.slice.call(arguments, 2);
    pending++;
    var id = origSetTimeout(function () {
      delete live[id];
      pending--;
      try { if (typeof fn === "function") fn.apply(self, extra); } catch (err) { fail(err); return; }
      settle();
    }, ms);
    live[id] = true;
    return id;
  };
  self.clearTimeout = function (id) {
    if (live[id]) { delete live[id]; pending--; }
    origClearTimeout(id);
  };
  self.setInterval = function (fn, ms) {
    var extra = Array.prototype.slice.call(arguments, 2);
    pending++;
    var id = origSetInterval(function () {
      try { if (typeof fn === "function") fn.apply(self, extra); } catch (err) { fail(err); }
    }, ms);
    live[id] = true;
    return id;
  };
  self.clearInterval = function (id) {
    if (live[id]) { delete live[id]; pending--; }
    origClearInterval(id);
  };

  if (self.addEventListener) {
    self.addEventListener("unhandledrejection", function (event) { fail(event.reason); });
  }

  self.onmessage = function (event) {
    self.onmessage = null;
    var code = event.data && event.data.code;
    try {
      (0, eval)(String(code));
    } catch (err) {
      fail(err);
      return;
    }
    settle();
  };
})();`;
}

/** Plain words for the time limit message. */
export function timeLimitMessage(timeoutMs: number): string {
  const seconds = timeoutMs / 1000;
  const shown = Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
  return `This code ran for more than ${shown} seconds, so it was stopped. A loop that never ends, or a very long job, can cause this.`;
}

/**
 * Turns an error from the worker into a sentence a beginner can act on, followed
 * by the browser's own wording in brackets so they can search for it.
 */
export function explainError(name: string, message: string): string {
  const own = `${name}: ${message}`;
  if (name === "SyntaxError") return `There is a typo in the code, so it could not start. (${own})`;
  if (name === "ReferenceError") return `The code uses a name that does not exist yet. Check the spelling, and that it is created before it is used. (${own})`;
  if (name === "TypeError") return `The code tried to use a value in a way that does not work for it. (${own})`;
  if (name === "RangeError" && /call stack/i.test(message)) {
    return `The code kept calling itself and ran out of room. (${own})`;
  }
  if (name === "RangeError") return `A number or size in the code is outside what is allowed. (${own})`;
  return `The code stopped with an error. (${own})`;
}

function defaultCreateWorker(source: string): WorkerLike {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  // The worker has already been asked to load; the address is no longer needed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return worker as unknown as WorkerLike;
}

export type RunHandle = {
  result: Promise<RunResult>;
  /** Stops the run and settles `result` with what was printed so far. */
  cancel: () => void;
};

/** Starts a run. Use `result` for the outcome and `cancel` to stop early. */
export function startRun(code: string, options: RunOptions = {}): RunHandle {
  const timeoutMs = options.timeoutMs ?? RUNNABLE_JS_TIME_LIMIT_MS;
  const maxLines = options.maxLines ?? RUNNABLE_JS_MAX_LINES;
  const maxLineLength = options.maxLineLength ?? RUNNABLE_JS_MAX_LINE_LENGTH;
  const createWorker = options.createWorker ?? defaultCreateWorker;

  const lines: OutputLine[] = [];
  let truncated = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let worker: WorkerLike | null = null;
  let resolveResult: (result: RunResult) => void = () => {};

  const result = new Promise<RunResult>((resolve) => {
    resolveResult = resolve;
  });

  const settle = (error: string | null, timedOut: boolean) => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    worker?.terminate();
    resolveResult({ lines, error, timedOut, truncated });
  };

  try {
    worker = createWorker(buildWorkerSource(maxLines, maxLineLength));
  } catch {
    settle("This example could not start in your browser.", false);
    return { result, cancel: () => {} };
  }

  worker.onmessage = (event) => {
    const data = event.data as { t?: string; level?: OutputLevel; text?: string; name?: string; message?: string } | null;
    if (!data || typeof data !== "object") return;
    if (data.t === "log" && typeof data.text === "string") {
      lines.push({ level: data.level === "warn" || data.level === "error" ? data.level : "log", text: data.text });
    } else if (data.t === "truncated") {
      truncated = true;
    } else if (data.t === "error") {
      settle(explainError(String(data.name ?? "Error"), String(data.message ?? "")), false);
    } else if (data.t === "done") {
      settle(null, false);
    }
  };
  worker.onerror = () => settle("This example could not start in your browser.", false);

  timer = setTimeout(() => settle(timeLimitMessage(timeoutMs), true), timeoutMs);
  worker.postMessage({ code });

  return { result, cancel: () => settle(null, false) };
}

/** Runs the code once and resolves with the result. */
export function runJs(code: string, options: RunOptions = {}): Promise<RunResult> {
  return startRun(code, options).result;
}
