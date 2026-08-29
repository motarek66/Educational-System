import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Eye, FilePlus2, MessageCircle, MoreHorizontal, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge, examStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatDate, formatNumber } from '../../lib/formatting';
import type { ApiResponse, ExamListItem, LessonListItem } from '../../types/api';

export function ExamsPage() {
  const query = useQuery({
    queryKey: ['exams'],
    queryFn: async () => (await api.get<ApiResponse<ExamListItem[]>>('/exams')).data.data,
  });
  const lessonsQuery = useQuery({
    queryKey: ['lessons'],
    queryFn: async () => (await api.get<ApiResponse<LessonListItem[]>>('/lessons')).data.data,
  });

  return (
    <>
      <PageHeader title="الامتحانات والدرجات" subtitle="أنشئ الامتحانات، أدخل الدرجات، راجعها ثم انشرها بأمان." actions={<Button><FilePlus2 size={18} /> إنشاء امتحان</Button>} />
      <Card className="panel mb-3">
        <div className="panel__header"><div><h2 className="panel__title">تقييمات الحصص</h2><p className="panel__subtitle">الحصة الجارية والحصص السابقة؛ الدرجات متاحة للطلاب الذين حضروا فقط.</p></div></div>
        <div className="row g-2">
          {lessonsQuery.data?.slice(0, 8).map((lesson) => <div className="col-md-6 col-xl-3" key={lesson.id}><Link to={`/lessons/${lesson.id}`} className="d-block rounded-3 p-3 text-decoration-none text-body h-100" style={{ background: 'var(--surface-subtle)' }}><div className="d-flex justify-content-between gap-2"><strong className="small">{lesson.title}</strong><StatusBadge label={lesson.status === 'OPEN' ? 'جارية' : 'سابقة'} tone={lesson.status === 'OPEN' ? 'success' : 'neutral'} /></div><div className="text-secondary mt-2" style={{ fontSize: 11 }}>{formatDate(lesson.startsAt)} · {formatNumber(lesson.gradesEntered)} درجة</div></Link></div>)}
          {!lessonsQuery.isLoading && lessonsQuery.data?.length === 0 ? <div className="text-secondary text-center py-3">لا توجد تقييمات حصص بعد.</div> : null}
        </div>
      </Card>
      {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? <Card className="skeleton" style={{ height: 420 }} /> : null}

      <div className="row g-3">
        {query.data?.map((exam) => <div className="col-lg-6" key={exam.id}><Card className="panel h-100"><div className="d-flex align-items-start justify-content-between gap-3"><div><div className="d-flex gap-2 align-items-center flex-wrap"><h2 className="h5 mb-0">{exam.name}</h2><StatusBadge {...examStatusMeta[exam.status]} /></div><p className="text-secondary small mt-2 mb-0">{exam.type}</p></div><button className="btn p-2"><MoreHorizontal size={20} /></button></div><div className="row g-2 mt-3"><div className="col-4"><div className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><CalendarDays size={18} color="var(--color-primary-600)" /><div className="text-secondary mt-2" style={{ fontSize: 11 }}>التاريخ</div><div className="small mt-1">{formatDate(exam.examDate)}</div></div></div><div className="col-4"><div className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><Users size={18} color="var(--color-primary-600)" /><div className="text-secondary mt-2" style={{ fontSize: 11 }}>السناتر</div><div className="small mt-1">{formatNumber(exam.centersCount)}</div></div></div><div className="col-4"><div className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><FilePlus2 size={18} color="var(--color-primary-600)" /><div className="text-secondary mt-2" style={{ fontSize: 11 }}>الدرجة</div><div className="small mt-1">{formatNumber(exam.maxScore)}</div></div></div></div><div className="d-flex justify-content-between align-items-center gap-2 mt-4"><span className="text-secondary small">تم إدخال {formatNumber(exam.gradedCount)} درجة</span><div className="d-flex gap-2"><Button variant="ghost"><MessageCircle size={17} /> رسائل</Button><Link className="app-button app-button--secondary" to={`/exams/${exam.id}/gradebook`}><Eye size={17} /> دفتر الدرجات</Link></div></div></Card></div>)}
      </div>
    </>
  );
}
