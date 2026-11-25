-- CreateTable
CREATE TABLE "TeachingClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "organizationId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingClassCourse" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingClassCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingClassMember" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingClassMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingClassDueDate" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingClassDueDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeachingClass_joinCode_key" ON "TeachingClass"("joinCode");

-- CreateIndex
CREATE INDEX "TeachingClass_teacherId_archivedAt_idx" ON "TeachingClass"("teacherId", "archivedAt");

-- CreateIndex
CREATE INDEX "TeachingClass_organizationId_idx" ON "TeachingClass"("organizationId");

-- CreateIndex
CREATE INDEX "TeachingClassCourse_courseId_idx" ON "TeachingClassCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingClassCourse_classId_courseId_key" ON "TeachingClassCourse"("classId", "courseId");

-- CreateIndex
CREATE INDEX "TeachingClassMember_userId_idx" ON "TeachingClassMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingClassMember_classId_userId_key" ON "TeachingClassMember"("classId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingClassDueDate_classId_moduleId_key" ON "TeachingClassDueDate"("classId", "moduleId");

-- AddForeignKey
ALTER TABLE "TeachingClass" ADD CONSTRAINT "TeachingClass_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClass" ADD CONSTRAINT "TeachingClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassCourse" ADD CONSTRAINT "TeachingClassCourse_classId_fkey" FOREIGN KEY ("classId") REFERENCES "TeachingClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassCourse" ADD CONSTRAINT "TeachingClassCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassMember" ADD CONSTRAINT "TeachingClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "TeachingClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassMember" ADD CONSTRAINT "TeachingClassMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassDueDate" ADD CONSTRAINT "TeachingClassDueDate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "TeachingClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingClassDueDate" ADD CONSTRAINT "TeachingClassDueDate_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
