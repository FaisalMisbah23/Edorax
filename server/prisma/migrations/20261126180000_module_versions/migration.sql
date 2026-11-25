-- A learner's chosen version per module: module key to version key. No entry means the default version.
ALTER TABLE "Enrollment" ADD COLUMN "moduleVersions" JSONB;

-- CreateTable
CREATE TABLE "ModuleVersionFeedback" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "versionKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleVersionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleVersionFeedback_courseId_moduleKey_idx" ON "ModuleVersionFeedback"("courseId", "moduleKey");

-- CreateIndex
CREATE INDEX "ModuleVersionFeedback_updatedAt_idx" ON "ModuleVersionFeedback"("updatedAt");

-- CreateIndex
CREATE INDEX "ModuleVersionFeedback_userId_idx" ON "ModuleVersionFeedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleVersionFeedback_enrollmentId_moduleKey_key" ON "ModuleVersionFeedback"("enrollmentId", "moduleKey");

-- AddForeignKey
ALTER TABLE "ModuleVersionFeedback" ADD CONSTRAINT "ModuleVersionFeedback_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleVersionFeedback" ADD CONSTRAINT "ModuleVersionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleVersionFeedback" ADD CONSTRAINT "ModuleVersionFeedback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
