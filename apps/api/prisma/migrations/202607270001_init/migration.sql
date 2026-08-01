-- Initial schema generated from prisma/schema.prisma
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "CenterStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'WITHDRAWN', 'SUSPENDED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'WITHDRAWN');
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'PARTIAL');
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'CODE', 'MANUAL', 'IMPORT');
CREATE TYPE "ExamType" AS ENUM ('QUIZ', 'HOMEWORK', 'WEEKLY', 'MONTHLY', 'MIDTERM', 'FINAL', 'OTHER');
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'OPEN_FOR_GRADING', 'PUBLISHED', 'LOCKED', 'CANCELLED');
CREATE TYPE "GradeStatus" AS ENUM ('GRADED', 'ABSENT', 'EXCUSED', 'NOT_SUBMITTED');
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'OTHER');
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'READY', 'IMPORTING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE "Organization" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logoUrl" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
  "locale" TEXT NOT NULL DEFAULT 'ar-EG',
  "settingsJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phoneE164" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById" UUID,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_organizationId_email_key" UNIQUE ("organizationId", "email"),
  CONSTRAINT "User_organizationId_phoneE164_key" UNIQUE ("organizationId", "phoneE164")
);

CREATE TABLE "Role" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystemRole" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_organizationId_name_key" UNIQUE ("organizationId", "name")
);

CREATE TABLE "Permission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL
);

CREATE TABLE "UserRole" (
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "RolePermission" (
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "UserCenterScope" (
  "userId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  PRIMARY KEY ("userId", "centerId")
);

CREATE TABLE "UserGroupScope" (
  "userId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  PRIMARY KEY ("userId", "groupId")
);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AcademicYear" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "codeYear" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicYear_organizationId_name_key" UNIQUE ("organizationId", "name")
);

CREATE TABLE "Center" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT,
  "contactPhoneE164" TEXT,
  "managerName" TEXT,
  "notes" TEXT,
  "status" "CenterStatus" NOT NULL DEFAULT 'ACTIVE',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Center_organizationId_name_key" UNIQUE ("organizationId", "name"),
  CONSTRAINT "Center_organizationId_code_key" UNIQUE ("organizationId", "code")
);

CREATE TABLE "Group" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "capacity" INTEGER,
  "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "primarySupervisorId" UUID,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Group_organizationId_academicYearId_code_key" UNIQUE ("organizationId", "academicYearId", "code")
);

CREATE TABLE "GroupSchedule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "groupId" UUID NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE
);

CREATE TABLE "Student" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "gender" TEXT,
  "birthDate" DATE,
  "studentPhoneE164" TEXT,
  "schoolName" TEXT,
  "address" TEXT,
  "photoUrl" TEXT,
  "medicalOrSensitiveNotes" TEXT,
  "generalNotes" TEXT,
  "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" UUID,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Guardian" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "whatsappPhoneE164" TEXT,
  "email" TEXT,
  "preferredContactMethod" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "StudentGuardian" (
  "studentId" UUID NOT NULL,
  "guardianId" UUID NOT NULL,
  "relationship" "GuardianRelationship" NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "canReceiveResults" BOOLEAN NOT NULL DEFAULT TRUE,
  "canReceiveAttendanceAlerts" BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY ("studentId", "guardianId")
);

CREATE TABLE "StudentAcademicProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "studentCode" TEXT NOT NULL,
  "qrTokenHash" TEXT NOT NULL,
  "qrVersion" INTEGER NOT NULL DEFAULT 1,
  "qrRotatedAt" TIMESTAMP(3),
  "gradeLevel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAcademicProfile_organizationId_academicYear_53747564" UNIQUE ("organizationId", "academicYearId", "studentCode"),
  CONSTRAINT "StudentAcademicProfile_studentId_academicYearId_key" UNIQUE ("studentId", "academicYearId")
);

CREATE TABLE "CodeSequence" (
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "entityType" TEXT NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("organizationId", "academicYearId", "entityType")
);

CREATE TABLE "Enrollment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "studentAcademicProfileId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "isPrimary" BOOLEAN NOT NULL DEFAULT TRUE,
  "transferReason" TEXT,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Lesson" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "title" TEXT,
  "lessonDate" DATE NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "lateAfterMinutes" INTEGER NOT NULL DEFAULT 15,
  "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
  "openedById" UUID,
  "openedAt" TIMESTAMP(3),
  "closedById" UUID,
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "AttendanceRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "lessonId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "checkInAt" TIMESTAMP(3),
  "method" "AttendanceMethod" NOT NULL,
  "recordedById" UUID NOT NULL,
  "correctionReason" TEXT,
  "isGuestAttendance" BOOLEAN NOT NULL DEFAULT FALSE,
  "originalCenterId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceRecord_lessonId_enrollmentId_key" UNIQUE ("lessonId", "enrollmentId")
);

CREATE TABLE "Exam" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ExamType" NOT NULL,
  "examDate" DATE NOT NULL,
  "maxScore" DECIMAL(8,2) NOT NULL,
  "passScore" DECIMAL(8,2),
  "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdById" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ExamAssignment" (
  "examId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "centerId" UUID NOT NULL,
  PRIMARY KEY ("examId", "groupId")
);

CREATE TABLE "Grade" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "examId" UUID NOT NULL,
  "enrollmentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "score" DECIMAL(8,2),
  "status" "GradeStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "percentage" DECIMAL(6,2),
  "feedback" TEXT,
  "enteredById" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Grade_examId_enrollmentId_key" UNIQUE ("examId", "enrollmentId")
);

CREATE TABLE "GradeChangeHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "gradeId" UUID NOT NULL,
  "oldScore" DECIMAL(8,2),
  "newScore" DECIMAL(8,2),
  "oldStatus" "GradeStatus" NOT NULL,
  "newStatus" "GradeStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "changedById" UUID NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "actorUserId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metadataJson" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ImportJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "createdById" UUID NOT NULL,
  "sourcePath" TEXT,
  "errorReportPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ExportJob" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "filtersJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
  "filePath" TEXT,
  "rowCount" INTEGER,
  "createdById" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "WhatsAppTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "bodyTemplate" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE;
ALTER TABLE "UserCenterScope" ADD CONSTRAINT "UserCenterScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "UserCenterScope" ADD CONSTRAINT "UserCenterScope_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id") ON DELETE CASCADE;
ALTER TABLE "UserGroupScope" ADD CONSTRAINT "UserGroupScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "UserGroupScope" ADD CONSTRAINT "UserGroupScope_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Center" ADD CONSTRAINT "Center_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Group" ADD CONSTRAINT "Group_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Group" ADD CONSTRAINT "Group_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "Group" ADD CONSTRAINT "Group_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id");
ALTER TABLE "GroupSchedule" ADD CONSTRAINT "GroupSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE;
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE CASCADE;
ALTER TABLE "StudentAcademicProfile" ADD CONSTRAINT "StudentAcademicProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "StudentAcademicProfile" ADD CONSTRAINT "StudentAcademicProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id");
ALTER TABLE "StudentAcademicProfile" ADD CONSTRAINT "StudentAcademicProfile_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "CodeSequence" ADD CONSTRAINT "CodeSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "CodeSequence" ADD CONSTRAINT "CodeSequence_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentAcademicProfileId_fkey" FOREIGN KEY ("studentAcademicProfileId") REFERENCES "StudentAcademicProfile" ("id");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User" ("id");
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id");
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_originalCenterId_fkey" FOREIGN KEY ("originalCenterId") REFERENCES "Center" ("id");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id");
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id");
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE;
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id");
ALTER TABLE "ExamAssignment" ADD CONSTRAINT "ExamAssignment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center" ("id");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment" ("id");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id");
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User" ("id");
ALTER TABLE "GradeChangeHistory" ADD CONSTRAINT "GradeChangeHistory_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE;
ALTER TABLE "GradeChangeHistory" ADD CONSTRAINT "GradeChangeHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id");
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id");

CREATE INDEX "User_organizationId_status_idx" ON "User" ("organizationId", "status");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession" ("userId", "revokedAt");
CREATE INDEX "AcademicYear_organizationId_status_idx" ON "AcademicYear" ("organizationId", "status");
CREATE INDEX "Center_organizationId_status_idx" ON "Center" ("organizationId", "status");
CREATE INDEX "Group_centerId_status_idx" ON "Group" ("centerId", "status");
CREATE INDEX "Student_organizationId_normalizedName_idx" ON "Student" ("organizationId", "normalizedName");
CREATE INDEX "Student_organizationId_studentPhoneE164_idx" ON "Student" ("organizationId", "studentPhoneE164");
CREATE INDEX "Student_organizationId_status_idx" ON "Student" ("organizationId", "status");
CREATE INDEX "Guardian_organizationId_phoneE164_idx" ON "Guardian" ("organizationId", "phoneE164");
CREATE INDEX "Guardian_organizationId_whatsappPhoneE164_idx" ON "Guardian" ("organizationId", "whatsappPhoneE164");
CREATE INDEX "StudentAcademicProfile_organizationId_qrTokenHash_idx" ON "StudentAcademicProfile" ("organizationId", "qrTokenHash");
CREATE INDEX "Enrollment_organizationId_groupId_status_idx" ON "Enrollment" ("organizationId", "groupId", "status");
CREATE INDEX "Enrollment_organizationId_centerId_status_idx" ON "Enrollment" ("organizationId", "centerId", "status");
CREATE INDEX "Lesson_organizationId_groupId_lessonDate_status_idx" ON "Lesson" ("organizationId", "groupId", "lessonDate", "status");
CREATE INDEX "AttendanceRecord_organizationId_lessonId_status_idx" ON "AttendanceRecord" ("organizationId", "lessonId", "status");
CREATE INDEX "AttendanceRecord_organizationId_studentId_status_idx" ON "AttendanceRecord" ("organizationId", "studentId", "status");
CREATE INDEX "Exam_organizationId_examDate_status_idx" ON "Exam" ("organizationId", "examDate", "status");
CREATE INDEX "Grade_organizationId_examId_studentId_idx" ON "Grade" ("organizationId", "examId", "studentId");
CREATE INDEX "AuditLog_organizationId_actorUserId_entityType_createdAt_idx" ON "AuditLog" ("organizationId", "actorUserId", "entityType", "createdAt");
CREATE INDEX "ImportJob_organizationId_createdAt_idx" ON "ImportJob" ("organizationId", "createdAt");
CREATE INDEX "ExportJob_organizationId_createdAt_idx" ON "ExportJob" ("organizationId", "createdAt");
