import type { RequestHandler } from "express";
import { canAccessTeachSurface } from "../services/auth/access-rules.js";
import { hasOrganizationTeachingRole } from "../services/organizations/members.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

/**
 * Class tools: platform instructors, and anyone who teaches in or runs an organisation.
 * Runs after `authenticate`. The class services still check each class one by one.
 */
export const requireClassTeacher: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) throw new UnauthorizedError("Not signed in");
    if (canAccessTeachSurface(req.user) || (await hasOrganizationTeachingRole(req.user.id))) return next();
    throw new ForbiddenError("Teaching access is required.", "INSTRUCTOR_REQUIRED");
  } catch (error) {
    next(error);
  }
};
