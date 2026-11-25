import { z } from "zod";
import { id, params } from "./common.js";

const name = z.string().trim().min(2, "Give the class a name.").max(120);
const when = z.string().datetime({ offset: true }).nullable();
const courseIds = z.array(id).min(1, "Pick at least one course.").max(20);

/** A class cannot end before it starts. Applied to bodies that carry both dates. */
const datesInOrder = (value: { startsAt?: string | null; endsAt?: string | null }) =>
  !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt);
const datesMessage = { message: "The end date must be after the start date.", path: ["endsAt"] };

export const classIdParams = params("classId");
export const classMemberParams = z.object({ classId: id, userId: id });
/** Join codes are stored in upper case; accept whatever the learner typed. */
export const classCodeParams = z.object({ code: z.string().trim().min(4).max(16).transform((value) => value.toUpperCase()) });

export const createClassBody = z
  .object({ name, courseIds, startsAt: when.optional(), endsAt: when.optional() })
  .refine(datesInOrder, datesMessage);

export const updateClassBody = z
  .object({
    name: name.optional(),
    courseIds: courseIds.optional(),
    startsAt: when.optional(),
    endsAt: when.optional(),
    archived: z.boolean().optional(),
  })
  .refine(datesInOrder, datesMessage);

/** `dueAt: null` clears a module's due date. */
export const classDueDatesBody = z.object({
  items: z.array(z.object({ moduleId: id, dueAt: when })).min(1).max(500),
});
