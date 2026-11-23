import { describe, expect, it } from "vitest";
import { META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, fitDescription } from "@/lib/seo";

const inRange = (text: string) => text.length >= META_DESCRIPTION_MIN && text.length <= META_DESCRIPTION_MAX;

describe("fitDescription", () => {
  it("keeps whole sentences that fit and drops the rest", () => {
    const text =
      "Find out how your laptop, phone and home router really reach the internet. Read the real numbers on your own machine, play with interactive pieces where addresses change hop by hop, and build a home network.";
    const out = fitDescription(text, ["107 short chapters, about 59 hours.", "Read, play, listen and prove it on Edorax."]);
    expect(out).toBe(
      "Find out how your laptop, phone and home router really reach the internet. 107 short chapters, about 59 hours. Read, play, listen and prove it on Edorax.",
    );
    expect(inRange(out)).toBe(true);
  });

  it("drops a leading byline", () => {
    const out = fitDescription("By Some Trainer. Learn Docker for work and for interviews by doing the job.", ["142 short chapters, about 100 hours.", "Read, play, listen and prove it on Edorax."]);
    expect(out.startsWith("Learn Docker")).toBe(true);
    expect(out).not.toContain("Some Trainer");
  });

  it("cuts one long sentence at a clause break", () => {
    const text =
      "Build a short-link service from parts, press Run, and see whether it shortens, redirects and counts clicks, and whether it keeps doing so when a server, the cache or the click worker dies.";
    const out = fitDescription(text, ["A system design lab on Edorax that runs in your browser.", "Change it, break it and watch what happens."]);
    expect(out.startsWith("Build a short-link service from parts, press Run, and see whether it shortens, redirects and counts clicks.")).toBe(true);
    expect(inRange(out)).toBe(true);
  });

  it("pads short text with the extras in order", () => {
    const out = fitDescription("Size an AWS web tier for launch day, then survive losing a zone.", [
      "An interactive lab on Edorax that runs in your browser.",
      "Change it, break it and watch what happens.",
    ]);
    expect(inRange(out)).toBe(true);
  });

  it("never goes over the maximum", () => {
    const out = fitDescription("word ".repeat(80));
    expect(out.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
  });
});
