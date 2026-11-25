import { Router } from "express";
import * as classes from "../../controllers/classes.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireClassTeacher } from "../../middlewares/require-class-teacher.js";
import { requireVerified } from "../../middlewares/require-verified.js";
import { validate, validateBody, validateParams } from "../../middlewares/validate.js";
import { classDueDatesBody, classIdParams, classMemberParams, createClassBody, updateClassBody } from "../../validations/classes.js";

// Teacher side of classes, mounted at /teach/classes. Open to platform instructors and to
// organisation teachers and admins; each call then checks that this person runs this class.
const router = Router();

router.use(authenticate, requireVerified, requireClassTeacher);
router.get("/", classes.listTeacherClasses);
router.get("/course-options", classes.listCourseOptions);
router.post("/", validateBody(createClassBody), classes.createClass);
router.get("/:classId", validateParams(classIdParams), classes.getTeacherClass);
router.patch("/:classId", validate({ params: classIdParams, body: updateClassBody }), classes.updateClass);
router.post("/:classId/rotate-code", validateParams(classIdParams), classes.rotateCode);
router.put("/:classId/due-dates", validate({ params: classIdParams, body: classDueDatesBody }), classes.setDueDates);
router.delete("/:classId/members/:userId", validateParams(classMemberParams), classes.removeMember);
router.get("/:classId/gradebook", validateParams(classIdParams), classes.getGradebook);
router.get("/:classId/gradebook/export", validateParams(classIdParams), classes.exportGradebook);

export default router;
