export type ApiMeta = {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

export type ApiResponse<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Array<{ field: string; message: string }>;
  };
  meta?: ApiMeta;
};

export type UserSummary = {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  permissions: string[];
  isSuperAdmin: boolean;
};

export type DashboardOverview = {
  activeStudents: number;
  centers: number;
  todayLessons: number;
  attendanceRate: number;
  gradeAverage: number;
  attendanceTrend: Array<{ label: string; present: number; absent: number }>;
  recentActivity: Array<{ id: string; title: string; description: string; createdAt: string }>;
  atRiskStudents: Array<{ id: string; fullName: string; reason: string; value: string }>;
};

export type StudentListItem = {
  id: string;
  fullName: string;
  studentCode: string;
  gradeLevel: string;
  centerName: string;
  guardianPhone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'SUSPENDED';
};

export type StudentProfile = StudentListItem & {
  studentPhone: string | null;
  schoolName: string | null;
  address: string | null;
  academicYear: { id: string; name: string; startDate: string; endDate: string } | null;
  guardians: Array<{
    id: string;
    fullName: string;
    relationship: string;
    phoneE164: string;
    whatsappPhoneE164: string | null;
    isPrimary: boolean;
  }>;
  attendanceSummary: { present: number; late: number; absent: number; rate: number };
  attendanceSessions: Array<{
    lessonId: string;
    title: string;
    lessonDate: string;
    startsAt: string;
    lessonStatus: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'PARTIAL' | null;
    checkInAt: string | null;
  }>;
  gradeSummary: { average: number; publishedExams: number };
};

export type LessonListItem = {
  id: string;
  title: string;
  lessonDate: string;
  startsAt: string;
  endsAt: string;
  centerName: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  presentCount: number;
  expectedCount: number;
};

export type AttendanceScanResult = {
  attendanceId: string;
  status: 'PRESENT' | 'LATE';
  recordedAt: string;
  student: {
    id: string;
    fullName: string;
    studentCode: string;
    photoUrl: string | null;
  };
  lesson: { id: string; title: string; month: number; year: number; week: number };
  lessonStats: { present: number; late: number; expected: number };
};

export type ExamListItem = {
  id: string;
  name: string;
  type: string;
  examDate: string;
  maxScore: number;
  status: 'DRAFT' | 'OPEN_FOR_GRADING' | 'PUBLISHED' | 'LOCKED' | 'CANCELLED';
  centersCount: number;
  gradedCount: number;
};

export type GradebookRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  score: number | null;
  status: 'GRADED' | 'ABSENT' | 'EXCUSED' | 'NOT_SUBMITTED';
};

export type CenterListItem = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  studentsCount: number;
  status: 'ACTIVE' | 'INACTIVE';
};

export type CenterDetails = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  students: Array<{
    id: string;
    fullName: string;
    studentCode: string;
    gradeLevel: string;
    guardianPhone: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'WITHDRAWN' | 'SUSPENDED';
  }>;
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  type: 'GENERAL' | 'GRADE' | 'ABSENCE' | 'LATE' | 'CUSTOM';
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WhatsAppPreview = {
  templateId: string;
  templateName: string;
  message: string;
  url: string | null;
};
