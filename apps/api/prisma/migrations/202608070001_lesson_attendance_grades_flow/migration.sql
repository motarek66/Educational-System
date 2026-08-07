-- Existing automatically-created weekly lessons are historical sessions. Close
-- them before enabling the new explicit active-lesson flow.
UPDATE "Lesson"
SET "status" = 'CLOSED',
    "closedAt" = COALESCE("closedAt", NOW()),
    "endsAt" = COALESCE("endsAt", NOW())
WHERE "status" = 'OPEN';

ALTER TABLE "Lesson" ALTER COLUMN "centerId" DROP NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "endsAt" DROP NOT NULL;

ALTER TABLE "Exam" ADD COLUMN "lessonId" UUID;
CREATE UNIQUE INDEX "Exam_lessonId_key" ON "Exam"("lessonId");
ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LessonCenterScope" (
  "lessonId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  CONSTRAINT "LessonCenterScope_pkey" PRIMARY KEY ("lessonId", "centerId")
);
CREATE INDEX "LessonCenterScope_centerId_idx" ON "LessonCenterScope"("centerId");
ALTER TABLE "LessonCenterScope"
  ADD CONSTRAINT "LessonCenterScope_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonCenterScope"
  ADD CONSTRAINT "LessonCenterScope_centerId_fkey"
  FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LessonCenterScope" ("lessonId", "centerId")
SELECT "id", "centerId" FROM "Lesson" WHERE "centerId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE "WeeklyAttendanceResult" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  "weekStart" DATE NOT NULL,
  "weekEnd" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABSENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyAttendanceResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklyAttendanceResult_enrollmentId_weekStart_key"
  ON "WeeklyAttendanceResult"("enrollmentId", "weekStart");
CREATE INDEX "WeeklyAttendanceResult_organizationId_academicYearId_weekStart_idx"
  ON "WeeklyAttendanceResult"("organizationId", "academicYearId", "weekStart");
CREATE INDEX "WeeklyAttendanceResult_organizationId_studentId_status_idx"
  ON "WeeklyAttendanceResult"("organizationId", "studentId", "status");
ALTER TABLE "WeeklyAttendanceResult"
  ADD CONSTRAINT "WeeklyAttendanceResult_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceResult"
  ADD CONSTRAINT "WeeklyAttendanceResult_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceResult"
  ADD CONSTRAINT "WeeklyAttendanceResult_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceResult"
  ADD CONSTRAINT "WeeklyAttendanceResult_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceResult"
  ADD CONSTRAINT "WeeklyAttendanceResult_centerId_fkey"
  FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
