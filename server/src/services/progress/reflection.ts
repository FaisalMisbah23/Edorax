import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { remarkChecklist } from "../../shared/mdx/remark-checklist.js";
import { remarkLearningLog } from "../../shared/mdx/remark-learning-log.js";
import { parseLearningLog, type LearningLogData } from "../../shared/lib/learning-log.js";

export type ReflectionRequirements = {
  checklistIds: string[];
  questionIds: string[];
};

type JsxAttribute = {
  name?: string;
  value?: string | { value?: string } | null;
};

function expressionSource(attribute: JsxAttribute | undefined): string | null {
  if (!attribute || attribute.value == null) return null;
  if (typeof attribute.value === "string") return attribute.value;
  if (typeof attribute.value.value === "string") return attribute.value.value;
  return null;
}

function idsFromJson(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return [];
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" && id.length > 0 ? [id] : [];
    });
  } catch {
    return [];
  }
}

/** Checklist item ids and learning-log question ids, using the same transforms as the reader. */
export function extractReflectionRequirements(source: string): ReflectionRequirements {
  let tree: ReturnType<ReturnType<typeof unified>["parse"]>;
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkGfm)
      .use(remarkChecklist)
      .use(remarkLearningLog);
    tree = processor.runSync(processor.parse(source));
  } catch {
    return { checklistIds: [], questionIds: [] };
  }

  const checklistIds: string[] = [];
  const questionIds: string[] = [];

  visit(tree, (node) => {
    if (!node || typeof node !== "object" || !("type" in node)) return;
    const type = (node as { type?: string }).type;
    if (type !== "mdxJsxFlowElement" && type !== "mdxJsxTextElement") return;
    const element = node as { name?: string; attributes?: JsxAttribute[] };
    const field = element.name === "Checklist" ? "items" : element.name === "LearningLog" ? "questions" : null;
    if (!field) return;
    const raw = expressionSource(element.attributes?.find((attribute) => attribute.name === field));
    if (!raw) return;
    const ids = idsFromJson(raw);
    if (field === "items") checklistIds.push(...ids);
    else questionIds.push(...ids);
  });

  return { checklistIds, questionIds };
}

/** Learning-log questions (id and title) in reading order, using the same transform as the reader. */
export function extractLearningLogQuestions(source: string): Array<{ id: string; title: string }> {
  let tree: ReturnType<ReturnType<typeof unified>["parse"]>;
  try {
    const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkLearningLog);
    tree = processor.runSync(processor.parse(source));
  } catch {
    return [];
  }
  const questions: Array<{ id: string; title: string }> = [];
  visit(tree, (node) => {
    if (!node || typeof node !== "object" || !("type" in node)) return;
    const element = node as { type?: string; name?: string; attributes?: JsxAttribute[] };
    if (element.type !== "mdxJsxFlowElement" || element.name !== "LearningLog") return;
    const raw = expressionSource(element.attributes?.find((attribute) => attribute.name === "questions"));
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        const { id, title } = (item ?? {}) as { id?: unknown; title?: unknown };
        if (typeof id === "string" && id && typeof title === "string" && title) questions.push({ id, title });
      }
    } catch {
      // A malformed list is skipped; the rest of the chapter still reads.
    }
  });
  return questions;
}

export function reflectionSatisfied(requirements: ReflectionRequirements, log: LearningLogData): boolean {
  for (const id of requirements.checklistIds) {
    if (log.checklist?.[id]?.checked !== true) return false;
  }
  for (const id of requirements.questionIds) {
    if (!(log.answers[id]?.text ?? "").trim()) return false;
  }
  return true;
}

export function milestoneReflectionBlocked(source: string, learningLog: unknown): boolean {
  return !reflectionSatisfied(extractReflectionRequirements(source), parseLearningLog(learningLog));
}
