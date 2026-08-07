import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, Eye, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge, lessonStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDateTime, formatNumber } from '../../lib/formatting';
import type { ApiResponse, LessonListItem } from '../../types/api';

export function LessonsPage() {
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const query = useQuery({ queryKey: ['lessons'], queryFn: async () => (await api.get<ApiResponse<LessonListItem[]>>('/lessons')).data.data });
  const lessons = useMemo(() => (query.data ?? []).filter((lesson) => status === 'ALL' || lesson.status === status).sort((a, b) => sort === 'OLDEST' ? +new Date(a.startsAt) - +new Date(b.startsAt) : +new Date(b.startsAt) - +new Date(a.startsAt)), [query.data, sort, status]);

  return <>
    <PageHeader title="الحصص" subtitle="سجل كامل لكل حصة، وقت بدايتها ونهايتها، والطلاب الذين حضروا ودرجاتهم." />
    <Card className="panel mb-3"><div className="row g-2"><div className="col-md-6"><label className="form-label">الحالة</label><select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">كل الحالات</option><option value="OPEN">جارية</option><option value="CLOSED">منتهية</option></select></div><div className="col-md-6"><label className="form-label">الترتيب</label><select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="NEWEST">الأحدث أولًا</option><option value="OLDEST">الأقدم أولًا</option></select></div></div></Card>
    {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
    {query.isLoading ? <Card className="skeleton" style={{ height: 360 }} /> : null}
    {!query.isLoading && lessons.length === 0 ? <EmptyState title="لا توجد حصص" description="ابدأ أول حصة من صفحة الحضور، وستظهر هنا تلقائيًا." /> : null}
    <div className="row g-3">{lessons.map((lesson) => <div className="col-xl-6" key={lesson.id}><Card className="panel h-100"><div className="d-flex justify-content-between gap-3"><div><div className="d-flex gap-2 align-items-center flex-wrap"><h2 className="h5 mb-0">{lesson.title}</h2><StatusBadge {...lessonStatusMeta[lesson.status]} /></div><div className="text-secondary small mt-2">{lesson.centers.map((center) => center.name).join('، ')}</div></div><Link className="app-button app-button--secondary" to={`/lessons/${lesson.id}`}><Eye size={17} /> التفاصيل</Link></div><div className="row g-2 mt-3"><div className="col-6"><div className="rounded-3 p-3 h-100" style={{ background: 'var(--surface-subtle)' }}><CalendarDays size={18} color="var(--color-primary-600)" /><div className="text-secondary small mt-2">بدأت</div><div className="small fw-semibold mt-1">{formatDateTime(lesson.startsAt)}</div></div></div><div className="col-6"><div className="rounded-3 p-3 h-100" style={{ background: 'var(--surface-subtle)' }}><Clock3 size={18} color="var(--color-primary-600)" /><div className="text-secondary small mt-2">انتهت</div><div className="small fw-semibold mt-1">{lesson.endsAt ? formatDateTime(lesson.endsAt) : 'ما زالت جارية'}</div></div></div></div><div className="d-flex gap-4 mt-3 text-secondary small"><span><Users size={15} className="ms-1" />{formatNumber(lesson.registeredCount)} حاضر</span><span>{formatNumber(lesson.lateCount)} متأخر</span><span>{formatNumber(lesson.gradesEntered)} درجة مسجلة</span></div></Card></div>)}</div>
  </>;
}
