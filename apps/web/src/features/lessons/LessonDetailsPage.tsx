import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Card } from '../../components/ui/Card';
import { StatusBadge, lessonStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber } from '../../lib/formatting';
import type { ApiResponse, LessonDetails } from '../../types/api';

function EditableGrade({ lessonId, enrollmentId, value, maxScore }: { lessonId: string; enrollmentId: string; value: number | null; maxScore: number }) {
  const client = useQueryClient();
  const [score, setScore] = useState(value === null ? '' : String(value));
  useEffect(() => setScore(value === null ? '' : String(value)), [value]);
  const mutation = useMutation({ mutationFn: () => api.put(`/lessons/${lessonId}/grades/${enrollmentId}`, { score: Number(score) }), onSuccess: () => void client.invalidateQueries({ queryKey: ['lesson', lessonId] }) });
  return <div><div className="d-flex gap-1"><input className="form-control form-control-sm ltr-value" style={{ width: 85 }} type="number" min={0} max={maxScore} step="0.5" value={score} onChange={(event) => setScore(event.target.value)} /><button className="btn btn-sm btn-outline-primary" disabled={!score || mutation.isPending} onClick={() => mutation.mutate()}><Save size={15} /></button></div>{mutation.isError ? <div className="text-danger mt-1" style={{ fontSize: 11 }}>{getApiErrorMessage(mutation.error)}</div> : null}</div>;
}

export function LessonDetailsPage() {
  const { lessonId = '' } = useParams();
  const query = useQuery({ queryKey: ['lesson', lessonId], queryFn: async () => (await api.get<ApiResponse<LessonDetails>>(`/lessons/${lessonId}`)).data.data, enabled: Boolean(lessonId) });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const lesson = query.data; if (!lesson) return null;
  return <>
    <div className="page-header"><div className="d-flex align-items-center gap-2"><Link to="/lessons" className="btn p-2"><ArrowRight size={20} /></Link><div><div className="d-flex gap-2 align-items-center"><h1 className="page-title">{lesson.title}</h1><StatusBadge {...lessonStatusMeta[lesson.status]} /></div><p className="page-subtitle">{lesson.centers.map((center) => center.name).join('، ')}</p></div></div></div>
    <div className="metric-grid mb-3"><Card className="metric-card"><div className="metric-card__label">بدأت</div><div className="fw-semibold mt-2">{formatDateTime(lesson.startsAt)}</div></Card><Card className="metric-card"><div className="metric-card__label">انتهت</div><div className="fw-semibold mt-2">{lesson.endsAt ? formatDateTime(lesson.endsAt) : 'ما زالت جارية'}</div></Card><Card className="metric-card"><div className="metric-card__label">الحضور</div><div className="metric-card__value">{formatNumber(lesson.summary.registered)}</div></Card><Card className="metric-card"><div className="metric-card__label">الدرجات المسجلة</div><div className="metric-card__value">{formatNumber(lesson.summary.gradesEntered)}</div></Card></div>
    <Card className="panel"><div className="panel__header"><div><h2 className="panel__title">الطلاب الذين حضروا</h2><p className="panel__subtitle">لا تظهر في هذه القائمة أي حالات غياب؛ الغياب يُحسب أسبوعيًا.</p></div></div><div className="table-responsive"><table className="table align-middle"><thead><tr><th>الطالب</th><th>السنتر / المرحلة</th><th>وقت التسجيل</th><th>الحالة</th><th>الدرجة</th></tr></thead><tbody>{lesson.rows.map((row) => <tr key={row.attendanceId}><td><Link to={`/students/${row.studentId}`} className="fw-semibold text-decoration-none">{row.fullName}</Link><div className="text-secondary small ltr-value">{row.studentCode}</div></td><td>{row.centerName}<div className="text-secondary small">{row.gradeLevel}</div></td><td>{formatDateTime(row.checkInAt)}</td><td><StatusBadge label={row.attendanceStatus === 'LATE' ? 'متأخر' : 'حاضر'} tone={row.attendanceStatus === 'LATE' ? 'warning' : 'success'} /></td><td>{lesson.assessment ? <EditableGrade lessonId={lesson.id} enrollmentId={row.enrollmentId} value={row.score} maxScore={lesson.assessment.maxScore} /> : '—'}</td></tr>)}</tbody></table>{lesson.rows.length === 0 ? <div className="text-center text-secondary py-4">لا يوجد حضور مسجل في هذه الحصة.</div> : null}</div></Card>
  </>;
}
