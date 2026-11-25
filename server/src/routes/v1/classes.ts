import { Router } from "express";
import * as classes from "../../controllers/classes.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireVerified } from "../../middlewares/require-verified.js";
import { validateParams } from "../../middlewares/validate.js";
import { classCodeParams, classIdParams } from "../../validations/classes.js";

// The learner side of classes. Teacher routes are under /teach/classes.
const router = Router();

// Anyone holding the code may see what it leads to before they sign in.
router.get("/join/:code", validateParams(classCodeParams), classes.previewJoin);

router.use(authenticate);
router.get("/", classes.listMyClasses);
router.post("/join/:code", requireVerified, validateParams(classCodeParams), classes.join);
router.post("/:classId/leave", validateParams(classIdParams), classes.leave);

export default router;
