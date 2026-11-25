import { Worker as NodeWorker } from "node:worker_threads";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  explainError,
  runJs,
  startRun,
  timeLimitMessage,
  type RunOptions,
  type WorkerLike,
} from "@buildment/learning-ui/lib/run-js";
import { RunnableJs } from "@buildment/learning-ui/components/learn/content-blocks/runnable-js";
import { sharedLessonBlocks } from "@buildment/learning-ui/lesson-blocks";

/**
 * Runs the real worker script in a Node worker. Node has no Web Worker, so a
 * small shim gives the script the few globals a browser worker has.
 */
function nodeWorker(source: string): WorkerLike {
  const shim = [
    'const { parentPort } = require("node:worker_threads");',
    "globalThis.self = globalThis;",
    "globalThis.postMessage = (message) => parentPort.postMessage(message);",
    "globalThis.addEventListener = () => {};",
    'parentPort.on("message", (data) => { if (globalThis.onmessage) globalThis.onmessage({ data }); });',
    "",
  ].join("\n");
  const worker = new NodeWorker(shim + source, { eval: true });
  const like: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (message) => worker.postMessage(message),
    terminate: () => void worker.terminate(),
  };
  worker.on("message", (data) => like.onmessage?.({ data }));
  worker.on("error", (error) => like.onerror?.({ message: error.message }));
  return like;
}

const run = (code: string, options: RunOptions = {}) => runJs(code, { createWorker: nodeWorker, ...options });

describe("runJs", () => {
  it("prints each console.log line in order", async () => {
    const result = await run('console.log("first");\nconsole.log("second", 2);\nconsole.log("third");');
    expect(result.lines.map((line) => line.text)).toEqual(["first", "second 2", "third"]);
    expect(result.error).toBeNull();
    expect(result.timedOut).toBe(false);
  });

  it("shows numbers, arrays and objects the way a beginner expects", async () => {
    const result = await run('console.log(1 + 2, [1, "a", true], { name: "Sam", age: 9 }, null, undefined);');
    expect(result.lines[0]?.text).toBe("3 [ 1, 'a', true ] { name: 'Sam', age: 9 } null undefined");
  });

  it("keeps warn and error lines marked", async () => {
    const result = await run('console.warn("careful");\nconsole.error("bad");');
    expect(result.lines).toEqual([
      { level: "warn", text: "careful" },
      { level: "error", text: "bad" },
    ]);
  });

  it("lets code that waits with setTimeout finish and print in order", async () => {
    const result = await run('console.log("a");\nsetTimeout(() => console.log("c"), 20);\nPromise.resolve().then(() => console.log("b"));');
    expect(result.lines.map((line) => line.text)).toEqual(["a", "b", "c"]);
    expect(result.error).toBeNull();
  });

  it("reports a thrown error in plain words and keeps the lines printed before it", async () => {
    const result = await run('console.log("before");\nnull.name;\nconsole.log("after");');
    expect(result.lines.map((line) => line.text)).toEqual(["before"]);
    expect(result.error).toMatch(/^The code tried to use a value in a way that does not work/);
    expect(result.error).toContain("TypeError");
    expect(result.timedOut).toBe(false);
  });

  it("explains a name that does not exist", async () => {
    const result = await run("console.log(missingName);");
    expect(result.error).toMatch(/name that does not exist yet/);
    expect(result.error).toContain("missingName is not defined");
  });

  it("explains a typo that stops the code starting", async () => {
    const result = await run("console.log(");
    expect(result.error).toMatch(/typo in the code/);
    expect(result.error).toContain("SyntaxError");
  });

  it("reports an error that is thrown on purpose", async () => {
    const result = await run('throw new Error("boom");');
    expect(result.error).toContain("boom");
  });

  it("stops an endless loop at the time limit and says so", async () => {
    const started = Date.now();
    const result = await run('console.log("start");\nwhile (true) {}', { timeoutMs: 400 });
    expect(Date.now() - started).toBeLessThan(2500);
    expect(result.timedOut).toBe(true);
    expect(result.error).toBe(timeLimitMessage(400));
    expect(result.lines.map((line) => line.text)).toEqual(["start"]);
  });

  it("stops code that waits on a timer that repeats forever", async () => {
    const result = await run('setInterval(() => console.log("tick"), 50);', { timeoutMs: 300 });
    expect(result.timedOut).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it("caps the output lines and says some were left out", async () => {
    const result = await run("for (let i = 0; i < 1000; i++) console.log(i);", { maxLines: 5 });
    expect(result.lines.map((line) => line.text)).toEqual(["0", "1", "2", "3", "4"]);
    expect(result.truncated).toBe(true);
    expect(result.error).toBeNull();
  });

  it("cuts a very long line", async () => {
    const result = await run('console.log("x".repeat(5000));', { maxLineLength: 20 });
    expect(result.lines[0]?.text).toBe("x".repeat(20) + "...");
  });

  it("removes the network and worker APIs before the example runs", async () => {
    const result = await run(
      "console.log(typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof importScripts, typeof Worker, typeof postMessage);",
    );
    expect(result.error).toBeNull();
    expect(result.lines[0]?.text).toBe("undefined undefined undefined undefined undefined undefined");
  });

  it("does not break ordinary objects that use the same names", async () => {
    const result = await run("const o = { close: 1, fetch: 2 };\no.close = 3;\nconsole.log(o.close, o.fetch);");
    expect(result.error).toBeNull();
    expect(result.lines[0]?.text).toBe("3 2");
  });

  it("does not let the example speak to the page directly", async () => {
    const result = await run('try { postMessage({ t: "done" }); } catch (e) {}\nconsole.log("still here");');
    expect(result.lines.map((line) => line.text)).toEqual(["still here"]);
  });

  it("starts every run clean, so the same names can be used again", async () => {
    const code = "let count = 1;\nconsole.log(count);";
    const first = await run(code);
    const second = await run(code);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.lines[0]?.text).toBe("1");
  });
});

describe("startRun", () => {
  it("settles with the lines so far when cancelled", async () => {
    const handle = startRun('console.log("one");\nwhile (true) {}', { createWorker: nodeWorker, timeoutMs: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    handle.cancel();
    const result = await handle.result;
    expect(result.lines.map((line) => line.text)).toEqual(["one"]);
    expect(result.timedOut).toBe(false);
  });

  it("says the example could not start when the worker cannot be made", async () => {
    const result = await runJs("1", {
      createWorker: () => {
        throw new Error("blocked");
      },
    });
    expect(result.error).toBe("This example could not start in your browser.");
  });
});

describe("explainError", () => {
  it("starts with a plain sentence and keeps the browser wording", () => {
    expect(explainError("RangeError", "Maximum call stack size exceeded")).toMatch(/kept calling itself/);
    expect(explainError("Error", "boom")).toBe("The code stopped with an error. (Error: boom)");
  });
});

describe("timeLimitMessage", () => {
  it("names the limit in seconds", () => {
    expect(timeLimitMessage(2000)).toContain("more than 2 seconds");
    expect(timeLimitMessage(1500)).toContain("more than 1.5 seconds");
  });
});

describe("RunnableJs", () => {
  const draw = (props: Parameters<typeof RunnableJs>[0]) => renderToStaticMarkup(createElement(RunnableJs, props));

  it("is registered as a lesson block", () => {
    expect(sharedLessonBlocks.RunnableJs).toBe(RunnableJs);
  });

  it("shows the code in an editor with Run and Reset and an output area", () => {
    const html = draw({ code: 'console.log("hi");\nconsole.log(2 + 2);' });
    expect(html).toContain("<textarea");
    expect(html).toContain("console.log(&quot;hi&quot;);");
    expect(html).toContain(">Run<");
    expect(html).toContain(">Reset<");
    expect(html).toContain('role="log"');
    expect(html).toContain("Press Run to see what this prints.");
    expect(html).toContain("Nothing is saved or sent.");
  });
});
