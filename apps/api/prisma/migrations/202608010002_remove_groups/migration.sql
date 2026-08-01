-- Convert exam targeting from groups to centers before removing group data.
CREATE TABLE "ExamCenterAssignment" (
  "examId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  CONSTRAINT "ExamCenterAssignment_pkey" PRIMARY KEY ("examId", "centerId")
);

INSERT INTO "ExamCenterAssignment" ("examId", "centerId")
SELECT DISTINCT "examId", "centerId" FROM "ExamAssignment";

ALTER TABLE "ExamCenterAssignment"
  ADD CONSTRAINT "ExamCenterAssignment_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamCenterAssignment"
  ADD CONSTRAINT "ExamCenterAssignment_centerId_fkey"
  FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "ExamAssignment";
ALTER TABLE "Enrollment" DROP COLUMN "groupId";
ALTER TABLE "Lesson" DROP COLUMN "groupId";
DROP TABLE "GroupSchedule";
DROP TABLE "UserGroupScope";
DROP TABLE "Group";
DROP TYPE "GroupStatus";
