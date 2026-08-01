import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge, examStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse, GradebookRow } from '../../types/api';

type GradebookPayload = {
  exam: { id: string; name: string; maxScore: number; status: 'DRAFT' | 'OPEN_FOR_GRADING' | 'PUBLISHED' | 'LOCKED' | 'CANCELLED' };
  rows: GradebookRow[];
};

export function GradebookPage() {
  const { examId = '' } = useParams();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GradebookRow[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['exam', examId, 'gradebook'],
    queryFn: async () => (await api.get<ApiResponse<GradebookPayload>>(`/exams/${examId}/gradebook`)).data.data,
    enabled: Boolean(examId),
  });

  useEffect(() => { if (query.data) setRows(query.data.rows); }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => api.put(`/exams/${examId}/grades/bulk`, {
      grades: rows.map((row) => ({ enrollmentId: row.enrollmentId, score: row.score, status: row.status })),
    }),
    onSuccess: async () => {
      setSuccess('تم حفظ الدرجات بنجاح.');
      await queryClient.invalidateQueries({ queryKey: ['exam', examId, 'gradebook'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => api.post(`/exams/${examId}/publish`),
    onSuccess: async () => {
      setSuccess('تم نشر الدرجات واعتمادها.');
      await queryClient.invalidateQueries({ queryKey: ['exam', examId, 'gradebook'] });
    },
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { exam } = query.data;
  const readOnly = exam.status === 'LOCKED' || exam.status === 'CANCELLED';

  const updateRow = (index: number, patch: Partial<GradebookRow>) => {
    setSuccess(null);
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2"><Link to="/exams" className="btn p-2"><ArrowRight size={20} /></Link><div><div className="d-flex gap-2 align-items-center flex-wrap"><h1 className="page-title">{exam.name}</h1><StatusBadge {...examStatusMeta[exam.status]} /></div><p className="page-subtitle">الدرجة النهائية: {exam.maxScore}</p></div></div>
        <div className="d-flex gap-2 flex-wrap"><Button variant="ghost" loading={saveMutation.isPending} disabled={readOnly} onClick={() => saveMutation.mutate()}><Save size={18} /> حفظ كمسودة</Button><Button loading={publishMutation.isPending} disabled={readOnly || exam.status === 'PUBLISHED'} onClick={() => publishMutation.mutate()}><CheckCircle2 size={18} /> نشر الدرجات</Button></div>
      </div>

      {success ? <div className="alert border-0 rounded-3" style={{ background: 'var(--color-success-50)', color: 'var(--color-success-500)' }}>{success}</div> : null}
      {saveMutation.isError ? <div className="alert alert-danger border-0">{getApiErrorMessage(saveMutation.error)}</div> : null}
      {readOnly ? <div className="alert border-0 rounded-3" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-700)' }}><LockKeyhole size={18} className="ms-2" />الامتحان مقفل ولا يمكن تعديل درجاته من المسار العادي.</div> : null}

      <Card className="overflow-hidden">
        <div className="table-responsive p-3">
          <table className="table">
            <thead><tr><th>الطالب</th><th>الكود</th><th style={{ width: 180 }}>الحالة</th><th style={{ width: 160 }}>الدرجة من {exam.maxScore}</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={row.enrollmentId}><td className="fw-semibold">{row.fullName}</td><td><span className="ltr-value d-inline-block">{row.studentCode}</span></td><td><select className="form-select form-select-sm" value={row.status} disabled={readOnly} onChange={(event) => updateRow(index, { status: event.target.value as GradebookRow['status'], score: event.target.value === 'GRADED' ? row.score : null })}><option value="NOT_SUBMITTED">غير مدخل</option><option value="GRADED">تم التصحيح</option><option value="ABSENT">غائب</option><option value="EXCUSED">بعذر</option></select></td><td><input className="form-control form-control-sm grade-input" type="number" min={0} max={exam.maxScore} step="0.5" value={row.score ?? ''} disabled={readOnly || row.status !== 'GRADED'} onChange={(event) => updateRow(index, { score: event.target.value === '' ? null : Number(event.target.value) })} aria-label={`درجة ${row.fullName}`} /></td></tr>)}</tbody>
          </table>
        </div>

        <div className="data-card-list p-3">{rows.map((row, index) => <div key={row.enrollmentId} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><div className="d-flex justify-content-between gap-2"><div><strong>{row.fullName}</strong><div className="text-secondary small ltr-value">{row.studentCode}</div></div><select className="form-select form-select-sm" style={{ width: 130 }} value={row.status} disabled={readOnly} onChange={(event) => updateRow(index, { status: event.target.value as GradebookRow['status'], score: event.target.value === 'GRADED' ? row.score : null })}><option value="NOT_SUBMITTED">غير مدخل</option><option value="GRADED">تم التصحيح</option><option value="ABSENT">غائب</option><option value="EXCUSED">بعذر</option></select></div><input className="form-control grade-input mt-3 w-100" type="number" min={0} max={exam.maxScore} value={row.score ?? ''} disabled={readOnly || row.status !== 'GRADED'} onChange={(event) => updateRow(index, { score: event.target.value === '' ? null : Number(event.target.value) })} placeholder={`الدرجة من ${exam.maxScore}`} /></div>)}</div>
      </Card>
    </>
  );
}
