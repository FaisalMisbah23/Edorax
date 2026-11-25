// GENERATED from server/src/shared — do not edit here. Run `pnpm sync-shared` in server/.
/**
 * Remark plugin that turns ```js run fences into <RunnableJs code="..." /> nodes
 * in the MDX tree. A ```js fence without the run word is left alone, so it stays
 * a read-only code block. The fence format is documented in
 * ../runnable-js/spec.ts. An invalid fence throws, so the mistake is caught when
 * the course is imported or compiled and never reaches a learner.
 */
import type { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import { isRunnableJsFence, parseRunnableJsFence } from "../runnable-js/spec";

export function remarkRunnableJs(): (tree: Root) => void {
  return (tree: Root) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (!isRunnableJsFence(node.lang, node.meta)) return;
      if (!parent || index == null) return;
      const code = parseRunnableJsFence(node.value);
      const mdxNode = {
        type: "mdxJsxFlowElement",
        name: "RunnableJs",
        attributes: [{ type: "mdxJsxAttribute", name: "code", value: code }],
        children: [],
      };
      parent.children.splice(index, 1, mdxNode as unknown as Code);
    });
  };
}
