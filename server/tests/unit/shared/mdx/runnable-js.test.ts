import { describe, expect, it } from "vitest";
import type { Root } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import {
  RUNNABLE_JS_MAX_SOURCE,
  isRunnableJsFence,
  parseRunnableJsFence,
} from "../../../../src/shared/runnable-js/spec.js";
import { remarkRunnableJs } from "../../../../src/shared/mdx/remark-runnable-js.js";
import { readerRemarkPlugins } from "../../../../src/shared/mdx/reader-plugins.js";
import { mdxComponentAllowlist } from "../../../../src/shared/mdx/component-allowlist.js";

describe("isRunnableJsFence", () => {
  it.each([
    ["js", "run", true],
    ["javascript", "run", true],
    ["JS", "run", true],
    ["js", "title=x run", true],
    ["js", null, false],
    ["js", "", false],
    ["js", "running", false],
    ["js", "norun", false],
    ["python", "run", false],
    ["ts", "run", false],
    [null, "run", false],
  ] as const)("lang %s with meta %s is %s", (lang, meta, expected) => {
    expect(isRunnableJsFence(lang, meta)).toBe(expected);
  });
});

describe("parseRunnableJsFence", () => {
  it("keeps the code and trims trailing blank lines", () => {
    expect(parseRunnableJsFence('console.log("a");\n\n')).toBe('console.log("a");');
  });

  it("rejects an empty fence", () => {
    expect(() => parseRunnableJsFence("  \n")).toThrow(/needs some code/);
  });

  it("rejects code that is too long", () => {
    expect(() => parseRunnableJsFence("x".repeat(RUNNABLE_JS_MAX_SOURCE + 1))).toThrow(/at most/);
  });
});

describe("remarkRunnableJs", () => {
  const compile = (markdown: string): Root => {
    const processor = unified().use(remarkParse).use(remarkMdx).use(remarkRunnableJs);
    return processor.runSync(processor.parse(markdown)) as Root;
  };

  it("turns a js run fence into a RunnableJs element carrying the code", () => {
    const tree = compile('Before\n\n```js run\nconsole.log("hi");\nconsole.log(2 + 2);\n```\n\nAfter\n');
    const node = tree.children[1] as unknown as { type: string; name: string; attributes: Array<{ name: string; value: string }> };
    expect(node.type).toBe("mdxJsxFlowElement");
    expect(node.name).toBe("RunnableJs");
    expect(node.attributes).toEqual([
      { type: "mdxJsxAttribute", name: "code", value: 'console.log("hi");\nconsole.log(2 + 2);' },
    ]);
    expect(tree.children).toHaveLength(3);
  });

  it("leaves a plain js fence exactly as it was", () => {
    const tree = compile('```js\nconsole.log("hi");\n```\n');
    const node = tree.children[0] as unknown as { type: string; lang: string; meta: string | null; value: string };
    expect(node.type).toBe("code");
    expect(node.lang).toBe("js");
    expect(node.meta ?? null).toBeNull();
    expect(node.value).toBe('console.log("hi");');
  });

  it("leaves other languages with the word run alone", () => {
    const tree = compile("```python run\nprint(1)\n```\n");
    expect((tree.children[0] as { type: string }).type).toBe("code");
  });

  it("fails the build on an empty js run fence", () => {
    expect(() => compile("```js run\n```\n")).toThrow(/needs some code/);
  });
});

describe("reader wiring", () => {
  it("is part of the reader plugin list and the component allowlist", () => {
    expect(readerRemarkPlugins).toContain(remarkRunnableJs);
    expect(mdxComponentAllowlist.has("RunnableJs")).toBe(true);
  });
});
