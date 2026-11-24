import { describe, expect, it } from "vitest";
import { extractLearningLogQuestions, extractReflectionRequirements, reflectionSatisfied } from "../../../../src/services/progress/reflection.js";
import { parseLearningLog } from "../../../../src/shared/lib/learning-log.js";

describe("extractReflectionRequirements", () => {
  it("reads checklist and learning-log ids from the reader transforms", () => {
    const source = `
## Gate checklist

- [ ] Explain the request path
- [ ] Name the collection

## Learning log

1. **What changed?** Describe the decision.
`;
    const requirements = extractReflectionRequirements(source);
    expect(requirements.checklistIds).toHaveLength(2);
    expect(requirements.questionIds).toHaveLength(1);
  });

  it("reads authored checklist and learning-log props", () => {
    const source = `
<Checklist items={[{"id":"box-1","label":"Done"}]} />

<LearningLog questions={[{"id":"q-1","title":"Why?"}]} />
`;
    expect(extractReflectionRequirements(source)).toEqual({
      checklistIds: ["box-1"],
      questionIds: ["q-1"],
    });
  });
});

describe("reflectionSatisfied", () => {
  const requirements = { checklistIds: ["box-1"], questionIds: ["q-1"] };

  it("requires every checklist item and a non-empty answer", () => {
    const empty = parseLearningLog(null);
    expect(reflectionSatisfied(requirements, empty)).toBe(false);
    expect(reflectionSatisfied(requirements, parseLearningLog({
      version: 1,
      answers: { "q-1": { text: "Because the route is locked.", updatedAt: "2026-01-01T00:00:00.000Z" } },
      checklist: { "box-1": { checked: true, updatedAt: "2026-01-01T00:00:00.000Z" } },
    }))).toBe(true);
  });
});

describe("extractLearningLogQuestions", () => {
  it("returns each question id with its title in reading order", () => {
    const source = `
## Learning log

1. **What changed?** Describe the decision.
2. **What would you try next?**
`;
    const questions = extractLearningLogQuestions(source);
    expect(questions.map((q) => q.title)).toEqual(["What changed?", "What would you try next?"]);
    expect(new Set(questions.map((q) => q.id)).size).toBe(2);
  });

  it("reads authored LearningLog props and ignores chapters without one", () => {
    expect(extractLearningLogQuestions(`<LearningLog questions={[{"id":"q-1","title":"Why?"}]} />`)).toEqual([{ id: "q-1", title: "Why?" }]);
    expect(extractLearningLogQuestions("# Just prose")).toEqual([]);
  });
});
