ALTER TABLE "Response" ADD COLUMN "aiDraftCostMicroUsd" INTEGER;

CREATE TYPE "HelpFeedbackScope" AS ENUM ('COURSE', 'PLATFORM');

ALTER TABLE "HelpThread" ADD COLUMN "feedbackScope" "HelpFeedbackScope",
ADD COLUMN "feedbackNote" TEXT,
ADD COLUMN "feedbackAt" TIMESTAMP(3);
