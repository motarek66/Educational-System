ALTER TABLE "Lesson" ADD COLUMN "weeklySlotKey" TEXT;
CREATE UNIQUE INDEX "Lesson_organizationId_academicYearId_centerId_weeklySlotKey_key"
  ON "Lesson"("organizationId", "academicYearId", "centerId", "weeklySlotKey");
