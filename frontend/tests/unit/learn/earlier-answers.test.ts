import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/earlier-answers", () => ({ loadEarlierAnswers: vi.fn() }));

import { EarlierAnswersButton, PersonalizedNote, PersonalizedPromptText } from "@/components/learn/earlier-answers";

const reference = { key: "a1", chapterSlug: "1-1-pick", chapterTitle: "Pick a project", question: "Which project?", answer: "A habit tracker" };

vi.mock("next/navigation", () => ({ useParams: () => ({ courseSlug: "demo" }) }));

describe("earlier answers", () => {
  it("highlights each marked phrase and keeps the rest as plain text", () => {
    const html = renderToStaticMarkup(
      createElement(PersonalizedPromptText, { prompt: "You chose [[a1|a habit tracker]]. Who uses it?", references: [reference] })
    );
    expect(html).toContain("a habit tracker");
    expect(html).toContain("font-semibold");
    expect(html).toContain("Who uses it?");
    expect(html).not.toContain("[[");
  });

  it("shows a marker with no matching reference as plain words", () => {
    const html = renderToStaticMarkup(createElement(PersonalizedPromptText, { prompt: "See [[a9|this]].", references: [reference] }));
    expect(html).toContain("this");
    expect(html).not.toContain("font-semibold");
  });

  it("explains the highlights on a rewritten question and offers chips on an authored one", () => {
    const rewritten = renderToStaticMarkup(createElement(PersonalizedNote, { rewritten: true, references: [reference] }));
    expect(rewritten).toContain("Hover or tap a highlighted phrase");
    const offered = renderToStaticMarkup(createElement(PersonalizedNote, { rewritten: false, references: [reference] }));
    expect(offered).toContain("Your earlier answers that connect here");
    expect(offered).toContain("A habit tracker");
  });

  it("renders nothing without references, or outside a reader provider", () => {
    expect(renderToStaticMarkup(createElement(PersonalizedNote, { rewritten: true, references: [] }))).toBe("");
    expect(renderToStaticMarkup(createElement(EarlierAnswersButton))).toBe("");
  });
});
