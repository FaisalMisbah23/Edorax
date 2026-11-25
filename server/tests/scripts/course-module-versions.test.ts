import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { strToU8, zipSync } from "fflate";
import { dump, load } from "js-yaml";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { createSession } from "../../src/services/auth/session.js";
import { importCourseZip, parseCourseZip, readCourseZip } from "../../src/services/teach/course-import.js";
import { approveCourseZipUpdate, previewCourseZipUpdate } from "../../src/services/teach/course-update.js";
import { CourseManifestSchema, moduleVersionSourceProblems } from "../../scripts/course-source.js";

// A course package whose second module also ships a rewritten "v2" version in its own folder.

const app = createApp();
const fixture = new URL("../fixtures/public-course/", import.meta.url);
const VERSION_DIR = "02-practice--v2";
const REWRITE = "This is the shorter, plainer rewrite of the practice module.";

type Manifest = Record<string, any> & { modules: { dir: string; lessons: { file: string; key?: string }[]; versions?: any[] }[] };

function fixtureFiles(): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of readdirSync(fixture, { withFileTypes: true })) if (entry.isDirectory()) {
    for (const file of readdirSync(new URL(`${entry.name}/`, fixture))) {
      files[`${entry.name}/${file}`] = strToU8(readFileSync(new URL(`${entry.name}/${file}`, fixture), "utf8"));
    }
  }
  return files;
}

function fixtureManifest(slug: string): Manifest {
  const manifest = load(readFileSync(new URL("course.yaml", fixture), "utf8")) as Manifest;
  manifest.slug = slug;
  return manifest;
}

/** The fixture course plus a v2 version of module 02, written from the default lessons with new text. */
function versionedPackage(slug: string) {
  const files = fixtureFiles();
  const manifest = fixtureManifest(slug);
  for (const file of ["02.01-set-the-scene.md", "02.02-checklist.md"]) {
    const original = Buffer.from(files[`02-practice/${file}`]!).toString("utf8");
    files[`${VERSION_DIR}/${file}`] = strToU8(`${original.trimEnd()}\n\n${REWRITE}\n`);
  }
  manifest.modules[1].versions = [{ key: "v2", label: "Rewritten: shorter and plainer", source: "agent-ip-v2", dir: VERSION_DIR,
    lessons: [
      { file: "02.01-set-the-scene.md", title: "Set the scene", goal: "Apply the idea, said more simply." },
      { file: "02.02-checklist.md", title: "Checklist", goal: "Review the decision." },
    ] }];
  return { files, manifest };
}

const zip = (files: Record<string, Uint8Array>, manifest: Manifest) =>
  Buffer.from(zipSync({ ...files, "course.yaml": strToU8(dump(manifest)) }));

async function activeRelease(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { activeReleaseId: true } });
  return course.activeReleaseId ? prisma.courseRelease.findUniqueOrThrow({ where: { id: course.activeReleaseId } }) : null;
}

describe("course package with a module version", () => {
  it("lets the ZIP path whitelist hold a version folder", () => {
    const files = readCourseZip(Buffer.from(zipSync({ "course.yaml": strToU8("slug: example"),
      [`${VERSION_DIR}/02.01-set-the-scene.md`]: strToU8("Hello") })));
    expect(Object.keys(files)).toContain(`${VERSION_DIR}/02.01-set-the-scene.md`);
  });

  it("imports the version, gives it its own addresses, lets a learner read it, and keeps ids on republish", async () => {
    const slug = `module-versions-${randomUUID()}`;
    const { files, manifest } = versionedPackage(slug);
    const parsed = await parseCourseZip(zip(files, manifest));
    expect(parsed.plan.modules[0].versions).toBeUndefined();
    expect(parsed.plan.modules[1].versions).toMatchObject([{ key: "v2", label: "Rewritten: shorter and plainer", source: "agent-ip-v2" }]);
    expect(parsed.plan.modules[1].versions![0].lessons.map(lesson => lesson.source)).toEqual([expect.stringContaining(REWRITE), expect.stringContaining(REWRITE)]);
    // The version folder is not a module of its own.
    expect(parsed.plan.modules).toHaveLength(2);

    const owner = await prisma.user.create({ data: { email: `owner-${slug}@test.local`, role: "MENTOR", emailVerified: new Date() } });
    const learner = await prisma.user.create({ data: { email: `learner-${slug}@test.local`, name: "Learner", role: "MENTEE", emailVerified: new Date() } });
    try {
      expect((await importCourseZip(owner, zip(files, manifest))).courseSlug).toBe(slug);
      const course = await prisma.course.findUniqueOrThrow({ where: { slug } });
      const release = (await activeRelease(course.id))!;
      expect(release).not.toBeNull();
      const modules = (release.content as any).variants.default as any[];
      expect(modules).toHaveLength(2);
      expect(modules[0].versions).toBeUndefined();
      const practice = modules[1];
      expect(practice.chapters.map((chapter: any) => chapter.slug)).toEqual(["2-1-set-the-scene", "2-2-checklist"]);
      expect(practice.versions).toHaveLength(1);
      expect(practice.versions[0]).toMatchObject({ key: "v2", label: "Rewritten: shorter and plainer" });
      const v2 = practice.versions[0].chapters as any[];
      expect(v2.map(chapter => chapter.slug)).toEqual(["2-v2-1-set-the-scene", "2-v2-2-checklist"]);
      const allSlugs = modules.flatMap(module => [...module.chapters, ...(module.versions ?? []).flatMap((version: any) => version.chapters)])
        .map((chapter: any) => chapter.slug);
      expect(new Set(allSlugs).size).toBe(allSlugs.length);
      const rows = await prisma.chapter.findMany({ where: { id: { in: v2.map(chapter => chapter.id) } } });
      expect(rows).toHaveLength(2);
      for (const row of rows) expect(row.source).toContain(REWRITE);

      // A learner picks v2 through the existing endpoints and reads the rewritten chapters.
      await prisma.course.update({ where: { id: course.id }, data: { status: "PUBLISHED", publishedAt: new Date(), sequential: false } });
      await prisma.enrollment.create({ data: { courseId: course.id, userId: learner.id, lifecycle: "ACTIVE" } });
      const auth = { Authorization: `Bearer ${(await createSession(learner.id)).sessionToken}` };
      const listed = await request(app).get(`/api/v1/courses/${slug}/module-versions`).set(auth);
      expect(listed.status, JSON.stringify(listed.body)).toBe(200);
      expect(listed.body.data.modules).toHaveLength(1);
      const moduleKey = listed.body.data.modules[0].moduleKey as string;
      expect(listed.body.data.modules[0].versions.map((version: any) => version.key)).toEqual(["default", "v2"]);
      const chosen = await request(app).put(`/api/v1/courses/${slug}/modules/${moduleKey}/version`).set(auth).send({ versionKey: "v2" });
      expect(chosen.status, JSON.stringify(chosen.body)).toBe(200);
      expect(chosen.body.data.firstChapterSlug).toBe("2-v2-1-set-the-scene");
      const reader = await request(app).get(`/api/v1/courses/${slug}/chapters/2-v2-1-set-the-scene`).set(auth);
      expect(reader.status, JSON.stringify(reader.body)).toBe(200);
      expect(JSON.stringify(reader.body.data)).toContain(REWRITE);
      const listedModule = reader.body.data.modules.find((module: any) => module.id === practice.id);
      expect(listedModule.chapters.map((chapter: any) => chapter.slug)).toEqual(["2-v2-1-set-the-scene", "2-v2-2-checklist"]);

      // The same package again changes nothing: no new release, the learner's chapters stay.
      const update = { ...manifest, publication: "update" };
      const same = await previewCourseZipUpdate(owner, course.id, zip(files, update));
      expect(same.warnings.join(" ")).toContain("module version");
      await approveCourseZipUpdate(owner, course.id, same.previewId);
      expect((await activeRelease(course.id))!.id).toBe(release.id);

      // A change to one v2 lesson replaces only that chapter; every other id is kept.
      const changedFiles = { ...files, [`${VERSION_DIR}/02.02-checklist.md`]: strToU8(`${Buffer.from(files[`${VERSION_DIR}/02.02-checklist.md`]!).toString("utf8")}\nOne more plain line.\n`) };
      const changed = await previewCourseZipUpdate(owner, course.id, zip(changedFiles, update));
      await approveCourseZipUpdate(owner, course.id, changed.previewId);
      const next = (await activeRelease(course.id))!;
      expect(next.id).not.toBe(release.id);
      const nextPractice = (next.content as any).variants.default[1];
      expect(nextPractice.chapters.map((chapter: any) => chapter.id)).toEqual(practice.chapters.map((chapter: any) => chapter.id));
      const nextV2 = nextPractice.versions[0].chapters as any[];
      expect(nextV2.map(chapter => chapter.slug)).toEqual(["2-v2-1-set-the-scene", "2-v2-2-checklist"]);
      expect(nextV2[0].id).toBe(v2[0].id);
      expect(nextV2[1].id).not.toBe(v2[1].id);
      expect((await prisma.chapter.findUniqueOrThrow({ where: { id: nextV2[1].id } })).source).toContain("One more plain line.");

      // A package that leaves the version out keeps it in the release.
      const without = structuredClone(update);
      delete without.modules[1].versions;
      const withoutFiles: Record<string, Uint8Array> = { ...changedFiles, "02-practice/02.01-set-the-scene.md": strToU8(`${Buffer.from(files["02-practice/02.01-set-the-scene.md"]!).toString("utf8")}\nA default edit.\n`) };
      delete withoutFiles[`${VERSION_DIR}/02.01-set-the-scene.md`];
      delete withoutFiles[`${VERSION_DIR}/02.02-checklist.md`];
      const kept = await previewCourseZipUpdate(owner, course.id, zip(withoutFiles, without));
      await approveCourseZipUpdate(owner, course.id, kept.previewId);
      const latest = (await activeRelease(course.id))!;
      expect(latest.id).not.toBe(next.id);
      expect((latest.content as any).variants.default[1].versions).toEqual(nextPractice.versions);
    } finally {
      await prisma.course.deleteMany({ where: { slug } });
      await prisma.session.deleteMany({ where: { userId: { in: [owner.id, learner.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, learner.id] } } });
    }
  }, 120000);

  it("imports a course without versions exactly as before", async () => {
    const slug = `no-versions-${randomUUID()}`;
    const files = fixtureFiles();
    const manifest = fixtureManifest(slug);
    const parsed = await parseCourseZip(zip(files, manifest));
    expect(parsed.plan.modules.some(module => "versions" in module)).toBe(false);
    expect(parsed.plan.manifest).not.toHaveProperty("modules.0.versions");
    const owner = await prisma.user.create({ data: { email: `owner-${slug}@test.local`, role: "MENTOR", emailVerified: new Date() } });
    try {
      await importCourseZip(owner, zip(files, manifest));
      const course = await prisma.course.findUniqueOrThrow({ where: { slug }, include: { chapters: true, modules: true } });
      // As before: live rows only, the first release is made when the course is published.
      expect(course.activeReleaseId).toBeNull();
      expect(course.modules).toHaveLength(2);
      expect(course.chapters.map(chapter => chapter.slug).sort()).toEqual(["1-1-set-the-scene", "1-2-roles-and-expectations", "1-3-checklist", "2-1-set-the-scene", "2-2-checklist"]);
    } finally {
      await prisma.course.deleteMany({ where: { slug } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
  }, 60000);
});

describe("course.yaml module versions: clear errors", () => {
  const base = () => versionedPackage("bad-versions").manifest;
  const issues = (manifest: Manifest) => {
    const result = CourseManifestSchema.safeParse(manifest);
    return result.success ? [] : result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`);
  };

  it("accepts the worked example", () => {
    expect(issues(base())).toEqual([]);
  });

  it("refuses the key default", () => {
    const manifest = base();
    manifest.modules[1].versions![0].key = "default";
    expect(issues(manifest).join("\n")).toContain('"default" names the module\'s own lessons');
  });

  it("refuses a key used twice in one module", () => {
    const manifest = base();
    manifest.modules[1].versions!.push({ ...manifest.modules[1].versions![0], dir: "02-practice--v2b" });
    expect(issues(manifest).join("\n")).toContain("Version key v2 is used twice in module 02-practice");
  });

  it("refuses a version that shares a folder with the module", () => {
    const manifest = base();
    manifest.modules[1].versions![0].dir = "02-practice";
    expect(issues(manifest).join("\n")).toContain("Version v2 needs its own folder; 02-practice already holds other lessons");
  });

  it("refuses a folder or lesson file with another module number", () => {
    const manifest = base();
    manifest.modules[1].versions![0].dir = "03-practice--v2";
    manifest.modules[1].versions![0].lessons[0].file = "03.01-set-the-scene.md";
    const text = issues(manifest).join("\n");
    expect(text).toContain("Version folder 03-practice--v2 must start with the module number 02");
    expect(text).toContain("03.01-set-the-scene.md must use module number 02");
  });

  it("refuses a lesson key that another lesson already uses", () => {
    const manifest = base();
    manifest.modules[1].lessons[0].key = "practice-scene";
    manifest.modules[1].versions![0].lessons[0].key = "practice-scene";
    expect(issues(manifest).join("\n")).toContain("Lesson key must be unique in this course, across every version");
  });

  it("refuses unknown fields and an empty label", () => {
    const manifest = base();
    manifest.modules[1].versions![0].label = " ";
    manifest.modules[1].versions![0].lesson = [];
    const text = issues(manifest).join("\n");
    expect(text).toMatch(/versions\.0\.label/);
    expect(text).toMatch(/Unrecognized key/);
  });

  it("names a missing folder and a missing lesson file", async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "module-versions-"));
    try {
      const manifest = CourseManifestSchema.parse(base());
      expect(moduleVersionSourceProblems(manifest, temporary)).toEqual([
        "modules.1.versions.0.dir: version v2 of 02-practice names folder 02-practice--v2/, which does not exist",
      ]);
      await mkdir(path.join(temporary, VERSION_DIR));
      await writeFile(path.join(temporary, VERSION_DIR, "02.01-set-the-scene.md"), "Hello\n");
      expect(moduleVersionSourceProblems(manifest, temporary)).toEqual([
        "modules.1.versions.0.lessons.1.file: 02-practice--v2/02.02-checklist.md does not exist",
      ]);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  });

  it("stops a ZIP import that lists a missing file or holds an unlisted one", async () => {
    const { files, manifest } = versionedPackage("bad-versions");
    const missing = { ...files };
    delete missing[`${VERSION_DIR}/02.02-checklist.md`];
    await expect(parseCourseZip(zip(missing, manifest))).rejects.toMatchObject({
      errors: [{ message: expect.stringContaining("02-practice--v2/02.02-checklist.md does not exist") }],
    });
    const extra = { ...files, [`${VERSION_DIR}/02.03-extra.md`]: strToU8("An extra lesson.\n") };
    await expect(parseCourseZip(zip(extra, manifest))).rejects.toMatchObject({
      errors: [{ message: expect.stringContaining("02-practice--v2/02.03-extra.md: File is not listed under version v2 of 02-practice") }],
    });
  }, 60000);
});
