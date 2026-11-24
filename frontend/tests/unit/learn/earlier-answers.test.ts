import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/actions/earlier-answers", () => ({ loadEarlierAnswers: vi.fn() }));

import { EarlierAnswersButton, PersonalizedNote } from "@/components/learn/earlier-answers";

describe("earlier answers", () => {
  it("names each chapter a personalized question was written from", () => {
    const html = renderToStaticMarkup(
      createElement(PersonalizedNote, {
        basedOn: [
          { chapterSlug: "01-01", chapterTitle: "Pick a product" },
          { chapterSlug: "02-03", chapterTitle: "Write the contract" },
        ],
      })
    );
    expect(html).toContain("Written from your earlier answers in");
    expect(html).toContain("Pick a product");
    expect(html).toContain("Write the contract");
  });

  it("renders nothing outside a reader provider", () => {
    expect(renderToStaticMarkup(createElement(EarlierAnswersButton))).toBe("");
  });
});
