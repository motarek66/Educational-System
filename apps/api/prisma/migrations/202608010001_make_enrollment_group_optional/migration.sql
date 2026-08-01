-- Temporarily allow creating center enrollments without assigning a group.
-- To restore the old flow, populate NULL groupId values first, then set this column NOT NULL.
ALTER TABLE "Enrollment" ALTER COLUMN "groupId" DROP NOT NULL;
