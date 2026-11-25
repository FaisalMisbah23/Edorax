import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExploreFeatures, FeaturePage } from "@/components/marketing/edorax/feature-page";
import { FEATURE_PAGES, featurePath, findFeaturePage, type FeaturePageContent } from "@/components/marketing/edorax/feature-pages";

const render = (page: FeaturePageContent) => renderToStaticMarkup(createElement(FeaturePage, { page }));

describe("feature landing pages", () => {
  it("gives every page its own slug, title and a description of 120 to 160 characters", () => {
    expect(new Set(FEATURE_PAGES.map((page) => page.slug)).size).toBe(FEATURE_PAGES.length);
    expect(new Set(FEATURE_PAGES.map((page) => page.seo.title)).size).toBe(FEATURE_PAGES.length);
    for (const page of FEATURE_PAGES) {
      expect(page.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(page.seo.description.length, page.slug).toBeGreaterThanOrEqual(120);
      expect(page.seo.description.length, page.slug).toBeLessThanOrEqual(160);
      expect(findFeaturePage(page.slug)).toBe(page);
    }
  });

  it("keeps the copy free of em dashes and trainer names", () => {
    const copy = JSON.stringify(FEATURE_PAGES);
    expect(copy).not.toContain("—");
    expect(copy).not.toMatch(/zeeshan/i);
  });

  it("draws one headline, the main button with its note, and the recording outside search snippets", () => {
    for (const page of FEATURE_PAGES) {
      const html = render(page);
      expect(html.match(/<h1/g), page.slug).toHaveLength(1);
      expect(html).toContain(page.headlineMark);
      // The button sits in the header, the hero and the closing band.
      expect(html.split(`href="${page.cta.href}"`).length - 1).toBeGreaterThanOrEqual(3);
      expect(html).toContain(page.cta.note.replace(/'/g, "&#x27;"));
      // The frame holds a real recording; a page without one shows no frame at all.
      if (page.demo.video) {
        expect(html).toContain(`poster="/video/${page.demo.video}.webp"`);
        expect(html).toMatch(/data-nosnippet=""[^>]*><div[^>]*>.*edorax\.com/s);
      } else {
        expect(html).not.toContain("<figure");
      }
      expect(html.match(/<details/g)).toHaveLength(page.questions.length);
    }
  });

  it("hides the proof number and the quote until a page has real ones", () => {
    const page = FEATURE_PAGES[0];
    expect(page.proof).toEqual({});
    const empty = render(page);
    expect(empty).not.toContain("<blockquote");
    const filled = render({ ...page, proof: { number: { value: "1,234", label: "answers reviewed" }, quote: { text: "It saved my weekend.", who: "A cohort lead" } } });
    expect(filled).toContain("1,234");
    expect(filled).toContain("answers reviewed");
    expect(filled).toMatch(/<blockquote[^>]*><p>It saved my weekend\.<\/p>/);
  });

  it("shows no frame, and no placeholder, when there is no recording yet", () => {
    const page = FEATURE_PAGES[0];
    const html = render({ ...page, demo: { ...page.demo, video: undefined } });
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<figure");
    expect(html).not.toMatch(/placeholder/i);
    const filmed = render({ ...page, demo: { ...page.demo, video: "feature-sample" } });
    expect(filmed).toContain('poster="/video/feature-sample.webp"');
    expect(filmed).toContain(page.demo.caption);
  });

  it("links every feature page from the home page row and from each other", () => {
    const row = renderToStaticMarkup(createElement(ExploreFeatures));
    for (const page of FEATURE_PAGES) expect(row).toContain(`href="${featurePath(page.slug)}"`);
    const [first, second] = FEATURE_PAGES;
    expect(render(first)).toContain(`href="${featurePath(second.slug)}"`);
  });
});
