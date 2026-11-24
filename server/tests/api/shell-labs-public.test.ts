import { describe, expect, it } from "vitest";
import { toPublicShellLab } from "../../src/services/shell-labs-public.js";

describe("toPublicShellLab", () => {
  const lab = {
    slug: "demo-linux",
    topic: "linux",
    level: "beginner",
    title: "Demo Linux",
    summary: "Folders and files.",
    scenario: "Tidy the reports folder.",
    minutes: 10,
    tags: ["Demo", 3, "Files"],
    machine: { name: "demobox", image: "ubuntu:24.04" },
    steps: [
      {
        id: "make-folder",
        goal: "Create the reports folder",
        body: "1. Go to /srv/demo.",
        hints: ["a", "b", "c"],
        checks: [{ id: "c1", label: "Folder exists", run: "test -d /srv/demo/reports", fail: "No folder." }],
        solution: "mkdir -p /srv/demo/reports",
      },
      { id: "", goal: "dropped: no id" },
    ],
  };

  it("keeps the catalogue fields and the goal of each step", () => {
    expect(toPublicShellLab(lab)).toEqual({
      slug: "demo-linux",
      topic: "linux",
      level: "beginner",
      title: "Demo Linux",
      summary: "Folders and files.",
      minutes: 10,
      scenario: "Tidy the reports folder.",
      tags: ["Demo", "Files"],
      steps: [{ id: "make-folder", goal: "Create the reports folder" }],
    });
  });

  it("never carries checks, hints, solutions or the machine", () => {
    const text = JSON.stringify(toPublicShellLab(lab));
    for (const secret of ["checks", "hints", "solution", "mkdir", "test -d", "machine", "ubuntu"]) expect(text).not.toContain(secret);
  });

  it("copes with a lab that has no steps", () => {
    expect(toPublicShellLab({ slug: "x" })).toMatchObject({ slug: "x", minutes: 0, scenario: null, tags: [], steps: [] });
  });
});
