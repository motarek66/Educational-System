import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, Building2, GraduationCap, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Card } from '../../components/ui/Card';
import { MetricCard } from '../../components/ui/MetricCard';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber, formatPercent } from '../../lib/formatting';
import type { ApiResponse, DashboardOverview } from '../../types/api';

export function DashboardPage() {
  const query = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => (await api.get<ApiResponse<DashboardOverview>>('/dashboard/overview')).data.data,
    staleTime: 60_000,
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const data = query.data;
  if (!data) return null;

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة شاملة على أداء الطلاب والحضور والدرجات." />

      <div className="metric-grid mb-3">
        <MetricCard label="الطلاب النشطون" value={formatNumber(data.activeStudents)} trend="إجمالي المسجلين في السنة الحالية" icon={GraduationCap} />
        <MetricCard label="السناتر" value={formatNumber(data.centers)} trend="إجمالي السناتر النشطة" icon={Building2} />
        <MetricCard label="نسبة الحضور" value={formatPercent(data.attendanceRate)} trend={`${formatNumber(data.todayLessons)} حصة اليوم`} icon={TrendingUp} />
        <MetricCard label="متوسط الدرجات" value={formatPercent(data.gradeAverage)} trend="من الامتحانات المنشورة" icon={BookOpenCheck} />
      </div>

      <div className="dashboard-grid">
        <Card className="panel">
          <div className="panel__header">
            <div><h2 className="panel__title">الأداء الأسبوعي</h2><p className="panel__subtitle">الحضور والغياب خلال آخر سبعة أيام</p></div>
            <StatusBadge label="هذا الأسبوع" tone="primary" />
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data.attendanceTrend} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#EEF0F4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#717784', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#717784', fontSize: 12 }} width={36} />
                <Tooltip contentStyle={{ border: '1px solid #E1E4EA', borderRadius: 12, boxShadow: 'none', fontFamily: 'Cairo' }} />
                <Line type="monotone" dataKey="present" name="حضور" stroke="#2F78F4" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="absent" name="غياب" stroke="#C4CAD4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="panel">
          <div className="panel__header">
            <div><h2 className="panel__title">طلاب يحتاجون متابعة</h2><p className="panel__subtitle">تنبيهات مبنية على الحضور والدرجات</p></div>
          </div>
          <div className="d-grid gap-2">
            {data.atRiskStudents.length === 0 ? (
              <div className="text-center text-secondary py-5">لا توجد تنبيهات حالية.</div>
            ) : data.atRiskStudents.map((student) => (
              <div key={student.id} className="d-flex align-items-center justify-content-between gap-3 rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="sidebar__brand-mark" style={{ width: 38, height: 38 }}>{student.fullName.slice(0, 1)}</div>
                  <div><div className="fw-semibold small">{student.fullName}</div><div className="text-secondary" style={{ fontSize: 12 }}>{student.reason}</div></div>
                </div>
                <StatusBadge label={student.value} tone="warning" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid mt-3">
        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">الأكثر غيابًا</h2><p className="panel__subtitle">نتائج الغياب الأسبوعي خلال آخر 30 يومًا</p></div></div>
          <div className="d-grid gap-2">{data.mostAbsentStudents.length === 0 ? <div className="text-secondary text-center py-4">لا توجد حالات غياب مسجلة.</div> : data.mostAbsentStudents.map((student) => <div className="d-flex justify-content-between align-items-center rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }} key={student.id}><span className="fw-semibold small">{student.fullName}</span><StatusBadge label={`${formatNumber(student.count)} غياب`} tone="danger" /></div>)}</div>
        </Card>
        <Card className="panel">
          <div className="panel__header"><div><h2 className="panel__title">الأكثر تأخيرًا</h2><p className="panel__subtitle">مرات التأخير خلال آخر 30 يومًا</p></div></div>
          <div className="d-grid gap-2">{data.mostLateStudents.length === 0 ? <div className="text-secondary text-center py-4">لا توجد حالات تأخير مسجلة.</div> : data.mostLateStudents.map((student) => <div className="d-flex justify-content-between align-items-center rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }} key={student.id}><span className="fw-semibold small">{student.fullName}</span><StatusBadge label={`${formatNumber(student.count)} تأخير`} tone="warning" /></div>)}</div>
        </Card>
      </div>

      <Card className="panel mt-3">
        <div className="panel__header">
          <div><h2 className="panel__title">آخر الأنشطة</h2><p className="panel__subtitle">أحدث العمليات المهمة داخل النظام</p></div>
        </div>
        <div className="row g-2">
          {data.recentActivity.length === 0 ? <div className="text-secondary py-4">لم تُسجل أنشطة بعد.</div> : data.recentActivity.map((item) => (
            <div className="col-md-6" key={item.id}>
              <div className="rounded-3 p-3 h-100" style={{ background: 'var(--surface-subtle)' }}>
                <div className="d-flex justify-content-between gap-3"><strong className="small">{item.title}</strong><span className="text-secondary" style={{ fontSize: 11 }}>{formatDateTime(item.createdAt)}</span></div>
                <p className="text-secondary small mb-0 mt-1">{item.description}</p>
                {item.actor ? (
                  <div className="text-secondary small mt-2">
                    بواسطة: <span className="fw-semibold text-body">{item.actor.fullName}</span>
                    {item.actor.email ? <span> ({item.actor.email})</span> : null}
                    {item.actor.isSuperAdmin ? ' • مسؤول رئيسي' : ' • مشرف'}
                  </div>
                ) : <div className="text-secondary small mt-2">بواسطة: النظام</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
