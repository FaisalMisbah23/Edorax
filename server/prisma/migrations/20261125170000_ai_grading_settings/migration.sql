-- AI grading settings: one default per instructor, optional overrides per course.
-- Additive only. A null course column means "use the course owner's default".
ALTER TABLE "Course" ADD COLUMN "aiReviewDraft" BOOLEAN,
ADD COLUMN "aiInstantGrading" BOOLEAN,
ADD COLUMN "aiGradingModel" TEXT;

-- Courses that already grade short answers instantly keep doing so as their own choice.
UPDATE "Course" SET "aiInstantGrading" = true WHERE "autoGradeOpenQuestions" = true;

CREATE TABLE "AiGradingDefault" (
    "userId" TEXT NOT NULL,
    "reviewDraft" BOOLEAN NOT NULL DEFAULT true,
    "instantGrading" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL DEFAULT 'claude-haiku-5-5',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiGradingDefault_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "AiGradingDefault" ADD CONSTRAINT "AiGradingDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
