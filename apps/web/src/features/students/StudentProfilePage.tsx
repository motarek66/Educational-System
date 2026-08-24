import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, ChevronDown, Clock3, Edit3, MessageCircle, Printer, QrCode, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { StatusBadge, studentStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber, formatPercent } from '../../lib/formatting';
import { can } from '../../lib/permissions/can';
import type { ApiResponse, StudentProfile } from '../../types/api';
import { useAuth } from '../auth/AuthContext';
import { WhatsAppDialog } from '../whatsapp/WhatsAppDialog';
import { StudentFormDialog } from './StudentFormDialog';
import {
  StudentCardPrintModal,
  type StudentCardQrSource,
} from './student-card-print';

type StudentQr = {
  studentId: string;
  studentCode: string;
  qrVersion: number;
  value: string;
  svg: string;
};

async function loadStudentQr(studentId: string): Promise<StudentQr> {
  return (await api.get<ApiResponse<StudentQr>>(`/students/${studentId}/qr`)).data.data;
}

const attendanceStatusMeta = {
  PRESENT: { label: 'حضر', tone: 'success' as const },
  LATE: { label: 'حضر متأخرًا', tone: 'warning' as const },
  ABSENT: { label: 'غائب', tone: 'danger' as const },
  EXCUSED: { label: 'غياب بعذر', tone: 'info' as const },
  PARTIAL: { label: 'حضور جزئي', tone: 'warning' as const },
};

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type AttendanceSession = StudentProfile['attendanceSessions'][number];
type AcademicMonth = { month: number; year: number; label: string };

function sessionMeta(session: AttendanceSession) {
  if (session.attendanceStatus) return attendanceStatusMeta[session.attendanceStatus];
  if (session.lessonStatus === 'CANCELLED') return { label: 'الحصة ملغاة', tone: 'neutral' as const };
  if (session.lessonStatus === 'OPEN') return { label: 'الحصة مفتوحة', tone: 'info' as const };
  if (session.lessonStatus === 'CLOSED') return { label: 'لم يُسجل حضور', tone: 'danger' as const };
  return { label: 'الحصة مجدولة', tone: 'neutral' as const };
}

function monthSessions(sessions: AttendanceSession[], config: AcademicMonth) {
  return sessions.filter((session) => {
    const date = new Date(session.lessonDate);
    return date.getUTCFullYear() === config.year && date.getUTCMonth() === config.month;
  });
}

function weekSessions(sessions: AttendanceSession[], weekIndex: number) {
  return sessions.filter((session) => {
    const day = new Date(session.lessonDate).getUTCDate();
    return Math.min(3, Math.floor((day - 1) / 7)) === weekIndex;
  });
}

function AttendanceMonth({ config, sessions, defaultOpen = false }: { config: AcademicMonth; sessions: AttendanceSession[]; defaultOpen?: boolean }) {
  const items = monthSessions(sessions, config);
  const attended = items.filter((item) => item.attendanceStatus === 'PRESENT' || item.attendanceStatus === 'LATE' || item.attendanceStatus === 'PARTIAL').length;

  return (
    <details className="attendance-month" open={defaultOpen}>
      <summary className="attendance-summary">
        <div><strong>{config.label}</strong><div className="text-secondary small mt-1">{attended} حضور · {items.length}/4 حصص</div></div>
        <ChevronDown className="attendance-chevron" size={20} />
      </summary>
      <div className="attendance-weeks">
        {[0, 1, 2, 3].map((weekIndex) => {
          const lessons = weekSessions(items, weekIndex);
          return <div className="attendance-week" key={weekIndex}>
            <div className="attendance-week__title">الأسبوع {weekIndex + 1}</div>
            {lessons.length === 0 ? <div className="attendance-week__empty">لم تُحدد حصة</div> : lessons.map((session) => {
              const meta = sessionMeta(session);
              return <div className="attendance-session" key={session.lessonId}>
                <StatusBadge {...meta} />
                <div className="small fw-semibold mt-2">{session.title}</div>
                <div className="text-secondary mt-1" style={{ fontSize: 11 }}><Clock3 size={13} className="ms-1" />{new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(session.lessonDate))}</div>
              </div>;
            })}
          </div>;
        })}
      </div>
    </details>
  );
}

function AttendanceTerm({ title, subtitle, months, sessions, defaultOpen = false }: { title: string; subtitle: string; months: AcademicMonth[]; sessions: AttendanceSession[]; defaultOpen?: boolean }) {
  return (
    <details className="attendance-term" open={defaultOpen}>
      <summary className="attendance-summary attendance-term__summary">
        <div><h3 className="h5 mb-1">{title}</h3><div className="text-secondary small">{subtitle}</div></div>
        <ChevronDown className="attendance-chevron" size={22} />
      </summary>
      <div className="d-grid gap-2 p-3 pt-0">
        {months.map((month, index) => <AttendanceMonth key={`${month.year}-${month.month}`} config={month} sessions={sessions} defaultOpen={defaultOpen && index === 0} />)}
      </div>
    </details>
  );
}

function AttendanceAcademicYear({ student }: { student: StudentProfile }) {
  if (!student.academicYear) return null;
  const startYear = new Date(student.academicYear.startDate).getUTCFullYear();
  const makeMonth = (month: number, year: number): AcademicMonth => ({ month, year, label: `${monthNames[month]} ${year}` });
  const firstTerm = [7, 8, 9, 10, 11].map((month) => makeMonth(month, startYear)).concat(makeMonth(0, startYear + 1));
  const secondTerm = [1, 2, 3, 4].map((month) => makeMonth(month, startYear + 1));

  return (
    <Card className="panel mt-3 attendance-calendar">
      <div className="panel__header">
        <div><h2 className="panel__title">سجل حضور السنة الدراسية</h2><p className="panel__subtitle">{student.academicYear.name} · 4 حصص شهريًا</p></div>
        <CalendarCheck size={21} color="var(--color-primary-600)" />
      </div>
      <div className="d-grid gap-3">
        <AttendanceTerm title="الترم الأول" subtitle="من أغسطس إلى يناير · 6 شهور · 24 حصة" months={firstTerm} sessions={student.attendanceSessions} defaultOpen />
        <AttendanceTerm title="الترم الثاني" subtitle="من فبراير إلى مايو · 4 شهور · 16 حصة" months={secondTerm} sessions={student.attendanceSessions} />
      </div>
    </Card>
  );
}

function StudentQrDialog({ studentId, studentName, open, onClose }: { studentId: string; studentName: string; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const qrQuery = useQuery({
    queryKey: ['student', studentId, 'qr'],
    queryFn: () => loadStudentQr(studentId),
    enabled: open,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const qrImage = qrQuery.data
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrQuery.data.svg)}`
    : undefined;

  return (
    <dialog ref={dialogRef} className="border-0 rounded-4 p-0" onCancel={onClose} onClose={onClose}>
      <div className="app-card p-4 text-center" style={{ width: 'min(94vw, 460px)' }}>
        <div className="d-flex justify-content-between align-items-start gap-3 text-start mb-3">
          <div><h2 className="h4 mb-1">QR Code الطالب</h2><p className="text-secondary small mb-0">{studentName}</p></div>
          <button className="btn-close" type="button" onClick={onClose} aria-label="إغلاق" />
        </div>
        {qrQuery.isLoading ? <div className="skeleton rounded-3 mx-auto" style={{ width: 280, height: 280 }} /> : null}
        {qrQuery.isError ? <ErrorState message={getApiErrorMessage(qrQuery.error)} onRetry={() => void qrQuery.refetch()} /> : null}
        {qrImage ? <img src={qrImage} width={280} height={280} alt={`QR Code للطالب ${studentName}`} className="img-fluid" /> : null}
        {qrQuery.data ? <div className="ltr-value fw-semibold mt-2">{qrQuery.data.studentCode}</div> : null}
        <Button variant="secondary" className="w-100 mt-4" onClick={onClose}>إغلاق</Button>
      </div>
    </dialog>
  );
}

export function StudentProfilePage() {
  const { studentId = '' } = useParams();
  const { user } = useAuth();
  const [isCardPrintOpen, setIsCardPrintOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const query = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => (await api.get<ApiResponse<StudentProfile>>(`/students/${studentId}/profile`)).data.data,
    enabled: Boolean(studentId),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const student = query.data;
  const loadStudentCardQr = async (): Promise<StudentCardQrSource> => {
    const qr = await loadStudentQr(studentId);
    return { kind: 'svg', value: qr.svg };
  };

  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2"><Link to="/students" className="btn p-2"><ArrowRight size={20} /></Link><div><h1 className="page-title">ملف الطالب</h1><p className="page-subtitle">البيانات الأكاديمية والحضور والدرجات والتواصل.</p></div></div>
        <div className="d-flex gap-2 flex-wrap"><Button type="button" variant="ghost" onClick={() => setIsCardPrintOpen(true)}><Printer size={18} /> طباعة الكارت</Button>{can(user, 'whatsapp.open_message') ? <Button variant="secondary" onClick={() => setWhatsAppOpen(true)}><MessageCircle size={18} /> رسالة واتساب</Button> : null}{can(user, 'students.update') ? <Button onClick={() => setEditOpen(true)}><Edit3 size={18} /> تعديل البيانات</Button> : null}</div>
      </div>

      <Card className="student-profile-hero mb-3">
        <div className="student-profile-hero__identity"><div className="avatar-lg">{student.fullName.slice(0, 2)}</div><div><div className="d-flex align-items-center gap-2 flex-wrap"><h2 className="h4 mb-0">{student.fullName}</h2><StatusBadge {...studentStatusMeta[student.status]} /></div><div className="d-flex gap-3 text-secondary small mt-2 flex-wrap"><span className="ltr-value">{student.studentCode}</span><span>{student.gradeLevel}</span><span>{student.centerName}</span></div></div></div>
        <Button variant="secondary" onClick={() => setQrOpen(true)}><QrCode size={18} /> عرض QR</Button>
      </Card>

      <div className="metric-grid mb-3">
        <MetricCard label="نسبة الحضور" value={formatPercent(student.attendanceSummary.rate)} trend={`${formatNumber(student.attendanceSummary.present)} حاضر · ${formatNumber(student.attendanceSummary.late)} متأخر`} icon={CalendarCheck} />
        <MetricCard label="متوسط الدرجات" value={formatPercent(student.gradeSummary.average)} trend={`${formatNumber(student.gradeSummary.publishedExams)} امتحان منشور`} icon={TrendingUp} />
        <MetricCard label="مرات الغياب" value={formatNumber(student.attendanceSummary.absent)} trend="في السنة الدراسية الحالية" icon={CalendarCheck} />
        <MetricCard label="الملف الأكاديمي" value={student.gradeLevel} trend={student.centerName} icon={QrCode} />
      </div>

      <div className="dashboard-grid">
        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">بيانات الطالب</h2><p className="panel__subtitle">المعلومات الأساسية والتعليمية</p></div></div>
          <dl className="row g-3 mb-0">
            <div className="col-md-6"><dt className="text-secondary small fw-normal">هاتف الطالب</dt><dd className="mt-1 ltr-value">{student.studentPhone ?? 'غير مسجل'}</dd></div>
            <div className="col-md-6"><dt className="text-secondary small fw-normal">السنة الدراسية</dt><dd className="mt-1">{student.academicYear?.name ?? 'غير مسجلة'}</dd></div>
          </dl>
        </Card>

        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">أولياء الأمور</h2><p className="panel__subtitle">جهات الاتصال المرتبطة بالطالب</p></div></div>
          <div className="d-grid gap-2">{student.guardians.map((guardian) => <div key={guardian.id} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><div className="d-flex justify-content-between gap-2"><strong>{guardian.fullName}</strong>{guardian.isPrimary ? <StatusBadge label="أساسي" tone="primary" /> : null}</div><div className="text-secondary small mt-1">{guardian.relationship}</div><div className="ltr-value mt-2">{guardian.whatsappPhoneE164 ?? guardian.phoneE164}</div></div>)}</div>
        </Card>
      </div>
      <AttendanceAcademicYear student={student} />
      <div className="dashboard-grid mt-3">
        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">الحضور الأسبوعي</h2><p className="panel__subtitle">النتيجة النهائية لكل أسبوع من السبت إلى الجمعة</p></div></div>
          <div className="d-grid gap-2">
            {student.weeklyAttendance.length === 0 ? <div className="text-secondary text-center py-4">لا توجد نتائج أسبوعية مكتملة بعد.</div> : [...student.weeklyAttendance].reverse().map((week) => <div className="d-flex justify-content-between align-items-center gap-3 rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }} key={week.weekStart}><div><strong className="small">أسبوع {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(week.weekStart))}</strong><div className="text-secondary mt-1" style={{ fontSize: 11 }}>حتى {new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(new Date(week.weekEnd))}</div></div><StatusBadge label={week.status === 'ABSENT' ? 'غائب' : week.status === 'LATE' ? 'متأخر' : 'حاضر'} tone={week.status === 'ABSENT' ? 'danger' : week.status === 'LATE' ? 'warning' : 'success'} /></div>)}
          </div>
        </Card>
        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">درجات الحصص</h2><p className="panel__subtitle">كل الحصص التي حضرها الطالب ودرجة كل حصة</p></div></div>
          <div className="d-grid gap-2">
            {student.lessonGrades.length === 0 ? <div className="text-secondary text-center py-4">لا توجد حصص مسجلة بعد.</div> : [...student.lessonGrades].reverse().map((item) => <Link to={`/lessons/${item.lessonId}`} className="d-flex justify-content-between align-items-center gap-3 rounded-3 p-3 text-decoration-none text-body" style={{ background: 'var(--surface-subtle)' }} key={item.lessonId}><div><strong className="small">{item.title}</strong><div className="text-secondary mt-1" style={{ fontSize: 11 }}>{item.centerName} · {formatDateTime(item.startsAt)}</div></div><StatusBadge label={item.score === null ? 'لم تُسجل' : `${formatNumber(item.score)} / ${formatNumber(item.maxScore)}`} tone={item.score === null ? 'neutral' : 'primary'} /></Link>)}
          </div>
        </Card>
      </div>
      <StudentQrDialog studentId={studentId} studentName={student.fullName} open={qrOpen} onClose={() => setQrOpen(false)} />
      <WhatsAppDialog student={student} open={whatsAppOpen} onClose={() => setWhatsAppOpen(false)} />
      <StudentFormDialog open={editOpen} studentId={studentId} onClose={() => setEditOpen(false)} />
      <StudentCardPrintModal
        open={isCardPrintOpen}
        onClose={() => setIsCardPrintOpen(false)}
        identity={{ name: student.fullName, code: student.studentCode }}
        loadQr={loadStudentCardQr}
      />
    </>
  );
}
