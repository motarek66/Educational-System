import { useMutation, useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileArchive, FileSpreadsheet, History, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime } from '../../lib/formatting';
import type { ApiResponse } from '../../types/api';

type ExportJob = {
  id: string;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  rowCount: number | null;
  createdAt: string;
  downloadUrl: string | null;
};

const exportMeta = {
  COMPLETED: { label: 'جاهز', tone: 'success' as const },
  PROCESSING: { label: 'جار التجهيز', tone: 'info' as const },
  QUEUED: { label: 'في الانتظار', tone: 'warning' as const },
  FAILED: { label: 'فشل', tone: 'danger' as const },
  EXPIRED: { label: 'منتهي', tone: 'neutral' as const },
};

export function ReportsPage() {
  const exportsQuery = useQuery({
    queryKey: ['exports'],
    queryFn: async () => (await api.get<ApiResponse<ExportJob[]>>('/exports')).data.data,
  });
  const snapshotMutation = useMutation({
    mutationFn: async () => api.post('/exports/full-snapshot'),
    onSuccess: () => void exportsQuery.refetch(),
  });

  const reportCards = [
    { title: 'تقرير الطلاب', description: 'قائمة الطلاب وبيانات التسجيل والسنتر.', icon: Users, endpoint: '/exports/students' },
    { title: 'تقرير الحضور', description: 'الحضور والغياب والتأخير حسب الفترة والسنتر.', icon: BarChart3, endpoint: '/exports/attendance' },
    { title: 'تقرير الدرجات', description: 'درجات الامتحانات والنسب ومتوسطات الأداء.', icon: FileSpreadsheet, endpoint: '/exports/grades' },
  ];

  return (
    <>
      <PageHeader title="التقارير والتصدير" subtitle="أنشئ تقارير دقيقة مع احترام الفلاتر والصلاحيات ونطاق البيانات." />
      <div className="row g-3 mb-3">{reportCards.map(({ title, description, icon: Icon, endpoint }) => <div className="col-lg-4" key={title}><Card className="panel h-100"><div className="metric-card__icon mb-3"><Icon size={20} /></div><h2 className="h5">{title}</h2><p className="text-secondary small">{description}</p><Button variant="secondary" className="w-100 mt-auto" onClick={() => void api.post(endpoint).then(() => exportsQuery.refetch())}><Download size={18} /> إنشاء ملف Excel</Button></Card></div>)}</div>
      <Card className="panel mb-3" style={{ background: 'var(--color-primary-600)', color: '#fff' }}><div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3"><div className="d-flex align-items-center gap-3"><div className="bg-white rounded-3 d-grid text-primary" style={{ width: 52, height: 52, placeItems: 'center' }}><FileArchive size={24} /></div><div><h2 className="h5 mb-1">نسخة Excel شاملة</h2><p className="mb-0 opacity-75 small">ملف ZIP يحتوي Manifest وملفات الطلاب والحضور والدرجات والعلاقات الأساسية.</p></div></div><Button variant="ghost" className="bg-white text-primary border-0" loading={snapshotMutation.isPending} onClick={() => snapshotMutation.mutate()}>تنزيل نسخة شاملة</Button></div>{snapshotMutation.isError ? <div className="small mt-3">{getApiErrorMessage(snapshotMutation.error)}</div> : null}</Card>
      <Card className="panel"><div className="panel__header"><div><h2 className="panel__title">سجل التصدير</h2><p className="panel__subtitle">الملفات متاحة لفترة محدودة وتُسجل في Audit Log.</p></div><History size={20} color="var(--color-primary-600)" /></div><div className="d-grid gap-2">{exportsQuery.data?.length ? exportsQuery.data.map((job) => <div key={job.id} className="rounded-3 p-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3" style={{ background: 'var(--surface-subtle)' }}><div><div className="fw-semibold">{job.type}</div><div className="text-secondary small">{formatDateTime(job.createdAt)}{job.rowCount !== null ? ` · ${job.rowCount} صف` : ''}</div></div><div className="d-flex align-items-center gap-2"><StatusBadge {...exportMeta[job.status]} />{job.downloadUrl && job.status === 'COMPLETED' ? <a className="app-button app-button--secondary" href={job.downloadUrl}><Download size={17} /> تنزيل</a> : null}</div></div>) : <div className="text-secondary text-center py-5">لم يتم إنشاء ملفات تصدير بعد.</div>}</div></Card>
    </>
  );
}
