import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge, lessonStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber } from '../../lib/formatting';
import type { ApiResponse, LessonDetails } from '../../types/api';

function MaxScoreEditor({ lessonId, assessmentId, maxScore }: { lessonId: string; assessmentId: string; maxScore: number }) {
  const client = useQueryClient();
  const [value, setValue] = useState(String(maxScore));
  useEffect(() => setValue(String(maxScore)), [maxScore, assessmentId]);
  const mutation = useMutation({
    mutationFn: () => api.put(`/lessons/${lessonId}/assessment`, { maxScore: Number(value) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['lesson', lessonId] }),
  });
  return (
    <div className="d-flex align-items-center gap-2">
      <label className="small text-secondary mb-0">الامتحان بكام؟</label>
      <input
        className="form-control form-control-sm ltr-value"
        style={{ width: 90 }}
        type="number"
        min={1}
        step="0.5"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button variant="secondary" onClick={() => mutation.mutate()} disabled={!value || Number(value) === maxScore || mutation.isPending}>
        <Save size={15} /> تحديد الدرجة النهائية
      </Button>
      {mutation.isError ? <span className="text-danger" style={{ fontSize: 11 }}>{getApiErrorMessage(mutation.error)}</span> : null}
    </div>
  );
}

export function LessonDetailsPage() {
  const { lessonId = '' } = useParams();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['lesson', lessonId], queryFn: async () => (await api.get<ApiResponse<LessonDetails>>(`/lessons/${lessonId}`)).data.data, enabled: Boolean(lessonId) });
  const [scores, setScores] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!query.data) return;
    setScores(Object.fromEntries(query.data.rows.map((row) => [row.enrollmentId, row.score === null ? '' : String(row.score)])));
  }, [query.data]);

  const bulkSave = useMutation({
    mutationFn: () => {
      const items = Object.entries(scores)
        .filter(([, score]) => score !== '')
        .map(([enrollmentId, score]) => ({ enrollmentId, score: Number(score) }));
      return api.put(`/lessons/${lessonId}/grades`, { items });
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['lesson', lessonId] }),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const lesson = query.data; if (!lesson) return null;
  return <>
    <div className="page-header"><div className="d-flex align-items-center gap-2"><Link to="/lessons" className="btn p-2"><ArrowRight size={20} /></Link><div><div className="d-flex gap-2 align-items-center"><h1 className="page-title">{lesson.title}</h1><StatusBadge {...lessonStatusMeta[lesson.status]} /></div></div></div></div>
    <div className="metric-grid mb-3"><Card className="metric-card"><div className="metric-card__label">بدأت</div><div className="fw-semibold mt-2">{formatDateTime(lesson.startsAt)}</div></Card><Card className="metric-card"><div className="metric-card__label">انتهت</div><div className="fw-semibold mt-2">{lesson.endsAt ? formatDateTime(lesson.endsAt) : 'ما زالت جارية'}</div></Card><Card className="metric-card"><div className="metric-card__label">الحضور</div><div className="metric-card__value">{formatNumber(lesson.summary.registered)}</div></Card><Card className="metric-card"><div className="metric-card__label">الدرجات المسجلة</div><div className="metric-card__value">{formatNumber(lesson.summary.gradesEntered)}</div></Card></div>
    <Card className="panel">
      <div className="panel__header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div><h2 className="panel__title">الطلاب الذين حضروا</h2><p className="panel__subtitle">لا تظهر في هذه القائمة أي حالات غياب؛ الغياب يُحسب أسبوعيًا.</p></div>
        {lesson.assessment ? <MaxScoreEditor lessonId={lesson.id} assessmentId={lesson.assessment.id} maxScore={lesson.assessment.maxScore} /> : null}
      </div>
      <div className="table-responsive">
        <table className="table align-middle">
          <thead><tr><th>الطالب</th><th>السنتر / المرحلة</th><th>وقت التسجيل</th><th>الحالة</th><th>الدرجة {lesson.assessment ? `(من ${formatNumber(lesson.assessment.maxScore)})` : ''}</th></tr></thead>
          <tbody>
            {lesson.rows.map((row) => <tr key={row.attendanceId}>
              <td><Link to={`/students/${row.studentId}`} className="fw-semibold text-decoration-none">{row.fullName}</Link><div className="text-secondary small ltr-value">{row.studentCode}</div></td>
              <td>{row.centerName}<div className="text-secondary small">{row.gradeLevel}</div></td>
              <td>{formatDateTime(row.checkInAt)}</td>
              <td><StatusBadge label={row.attendanceStatus === 'LATE' ? 'متأخر' : 'حاضر'} tone={row.attendanceStatus === 'LATE' ? 'warning' : 'success'} /></td>
              <td>{lesson.assessment ? <input className="form-control form-control-sm ltr-value" style={{ width: 85 }} type="number" min={0} max={lesson.assessment.maxScore} step="0.5" value={scores[row.enrollmentId] ?? ''} onChange={(event) => setScores((prev) => ({ ...prev, [row.enrollmentId]: event.target.value }))} /> : '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>

      <div className="data-card-list p-3">{lesson.rows.map((row) => <div key={row.attendanceId} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}>
        <div className="d-flex align-items-start justify-content-between gap-2">
          <Link to={`/students/${row.studentId}`} className="text-body"><div className="fw-semibold">{row.fullName}</div><div className="text-secondary small ltr-value">{row.studentCode}</div></Link>
          <StatusBadge label={row.attendanceStatus === 'LATE' ? 'متأخر' : 'حاضر'} tone={row.attendanceStatus === 'LATE' ? 'warning' : 'success'} />
        </div>
        <div className="text-secondary small mt-2">{row.centerName} · {row.gradeLevel} · {formatDateTime(row.checkInAt)}</div>
        {lesson.assessment ? <div className="mt-3"><label className="form-label small mb-1">الدرجة (من {formatNumber(lesson.assessment.maxScore)})</label><input className="form-control form-control-sm ltr-value" style={{ width: 100 }} type="number" min={0} max={lesson.assessment.maxScore} step="0.5" value={scores[row.enrollmentId] ?? ''} onChange={(event) => setScores((prev) => ({ ...prev, [row.enrollmentId]: event.target.value }))} /></div> : null}
      </div>)}</div>

      {lesson.rows.length === 0 ? <div className="text-center text-secondary py-4">لا يوجد حضور مسجل في هذه الحصة.</div> : null}
      {lesson.assessment && lesson.rows.length > 0 ? (
        <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
          {bulkSave.isError ? <span className="text-danger small">{getApiErrorMessage(bulkSave.error)}</span> : <span />}
          <Button onClick={() => bulkSave.mutate()} disabled={bulkSave.isPending}><Save size={17} /> حفظ كل الدرجات</Button>
        </div>
      ) : null}
    </Card>
  </>;
}
