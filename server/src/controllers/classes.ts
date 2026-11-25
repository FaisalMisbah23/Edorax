import type { Request, Response } from "express";
import * as classes from "../services/classes/classes.js";
import * as gradebook from "../services/classes/gradebook.js";
import { created, noContent, ok } from "../utils/responses.js";

const param = (req: Request, name: string) => req.params[name] as string;

// ─── Teacher: /api/v1/teach/classes ──────────────────────────────────────────

// GET /api/v1/teach/classes
export async function listTeacherClasses(req: Request, res: Response) {
  ok(res, await classes.listTeacherClasses(req.user!));
}

// GET /api/v1/teach/classes/course-options
export async function listCourseOptions(_req: Request, res: Response) {
  ok(res, await classes.listClassCourseOptions());
}

// POST /api/v1/teach/classes
export async function createClass(req: Request, res: Response) {
  created(res, await classes.createClass(req.user!, req.body));
}

// GET /api/v1/teach/classes/:classId
export async function getTeacherClass(req: Request, res: Response) {
  ok(res, await classes.loadTeacherClass(req.user!, param(req, "classId")));
}

// PATCH /api/v1/teach/classes/:classId
export async function updateClass(req: Request, res: Response) {
  ok(res, await classes.updateClass(req.user!, param(req, "classId"), req.body));
}

// POST /api/v1/teach/classes/:classId/rotate-code
export async function rotateCode(req: Request, res: Response) {
  ok(res, await classes.rotateClassCode(req.user!, param(req, "classId")));
}

// PUT /api/v1/teach/classes/:classId/due-dates
export async function setDueDates(req: Request, res: Response) {
  const { items } = req.body as { items: Array<{ moduleId: string; dueAt: string | null }> };
  ok(res, await classes.setClassDueDates(req.user!, param(req, "classId"), items));
}

// DELETE /api/v1/teach/classes/:classId/members/:userId
export async function removeMember(req: Request, res: Response) {
  await classes.removeClassMember(req.user!, param(req, "classId"), param(req, "userId"));
  noContent(res);
}

// GET /api/v1/teach/classes/:classId/gradebook
export async function getGradebook(req: Request, res: Response) {
  ok(res, await gradebook.loadClassGradebook(req.user!, param(req, "classId")));
}

// GET /api/v1/teach/classes/:classId/gradebook/export: CSV download, not the JSON envelope
export async function exportGradebook(req: Request, res: Response) {
  const { filename, csv } = await gradebook.exportClassGradebookCsv(req.user!, param(req, "classId"));
  res.attachment(filename).type("text/csv; charset=utf-8").send(csv);
}

// ─── Learner: /api/v1/classes ────────────────────────────────────────────────

// GET /api/v1/classes
export async function listMyClasses(req: Request, res: Response) {
  ok(res, await classes.listMyClasses(req.user!));
}

// GET /api/v1/classes/join/:code (public)
export async function previewJoin(req: Request, res: Response) {
  ok(res, await classes.getClassJoinPreview(param(req, "code")));
}

// POST /api/v1/classes/join/:code
export async function join(req: Request, res: Response) {
  ok(res, await classes.joinClass(req.user!, param(req, "code")));
}

// POST /api/v1/classes/:classId/leave
export async function leave(req: Request, res: Response) {
  await classes.leaveClass(req.user!, param(req, "classId"));
  noContent(res);
}
