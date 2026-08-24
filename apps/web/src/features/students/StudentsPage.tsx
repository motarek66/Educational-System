import { useQuery } from '@tanstack/react-query';
import { Download, Edit3, Eye, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchField } from '../../components/ui/SearchField';
import { StatusBadge, studentStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { can } from '../../lib/permissions/can';
import type { ApiResponse, StudentListItem } from '../../types/api';
import { useAuth } from '../auth/AuthContext';
import { StudentFormDialog } from './StudentFormDialog';

type PaginatedStudents = ApiResponse<StudentListItem[]>;

export function StudentsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => (await api.get<ApiResponse<Array<{ id: string; name: string }>>>('/academic-years')).data.data,
  });

  const query = useQuery({
    queryKey: ['students', { search, status, academicYearId, sort, page }],
    queryFn: async () => (await api.get<PaginatedStudents>('/students', { params: { search: search || undefined, status: status || undefined, academicYearId: academicYearId || undefined, sort, page, limit: 10 } })).data,
    placeholderData: (previous) => previous,
  });

  const students = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <>
      <PageHeader
        title="الطلاب"
        subtitle="إدارة بيانات الطلاب والأكواد وأولياء الأمور والملفات التعليمية."
        actions={<><Button variant="ghost"><Download size={18} /> تصدير</Button><Button variant="secondary"><Upload size={18} /> استيراد Excel</Button><Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة طالب</Button></>}
      />

      <Card className="toolbar mb-3">
        <SearchField value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ابحث بالاسم أو الكود أو الهاتف..." />
        <div className="toolbar__filters d-flex flex-row align-items-center gap-2 flex-wrap">
          <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">كل الحالات</option><option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option><option value="WITHDRAWN">منسحب</option><option value="SUSPENDED">موقوف</option>
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={academicYearId} onChange={(event) => { setAcademicYearId(event.target.value); setPage(1); }}><option value="">كل السنوات الدراسية</option>{academicYearsQuery.data?.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select>
          <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="nameAsc">الاسم: أ ← ي</option><option value="nameDesc">الاسم: ي ← أ</option></select>
        </div>
      </Card>

      {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {!query.isError && query.isLoading ? <Card className="skeleton" style={{ height: 440 }} /> : null}
      {!query.isLoading && !query.isError && students.length === 0 ? <EmptyState title="لا توجد نتائج" description={search ? 'جرّب تغيير كلمة البحث أو الفلاتر.' : 'ابدأ بإضافة أول طالب أو استيراد ملف Excel.'} action={<Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة طالب</Button>} /> : null}

      {students.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="table-responsive p-3">
            <table className="table align-middle">
              <thead><tr><th>الطالب</th><th>الكود</th><th>السنتر</th><th>ولي الأمر</th><th>الحالة</th><th aria-label="الإجراءات" /></tr></thead>
              <tbody>{students.map((student) => {
                const metaStatus = studentStatusMeta[student.status];
                return <tr key={student.id}><td><div className="d-flex align-items-center gap-3"><div className="sidebar__brand-mark" style={{ width: 38, height: 38 }}>{student.fullName.slice(0, 1)}</div><div><div className="fw-semibold">{student.fullName}</div><div className="text-secondary small">{student.gradeLevel}</div></div></div></td><td><span className="ltr-value d-inline-block fw-medium">{student.studentCode}</span></td><td><div>{student.centerName}</div></td><td><span className="ltr-value d-inline-block">{student.guardianPhone ?? '—'}</span></td><td><StatusBadge {...metaStatus} /></td><td><div className="d-flex gap-1"><Link className="btn p-2" to={`/students/${student.id}`} aria-label={`عرض ${student.fullName}`}><Eye size={18} /></Link>{can(user, 'students.update') ? <button className="btn p-2" onClick={() => setEditingStudentId(student.id)} aria-label={`تعديل ${student.fullName}`}><Edit3 size={18} /></button> : null}</div></td></tr>;
              })}</tbody>
            </table>
          </div>

          <div className="data-card-list p-3">{students.map((student) => {
            const metaStatus = studentStatusMeta[student.status];
            return <div key={student.id} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><div className="d-flex align-items-start justify-content-between gap-2"><Link to={`/students/${student.id}`} className="d-flex gap-3 text-body"><div className="sidebar__brand-mark">{student.fullName.slice(0, 1)}</div><div><div className="fw-semibold">{student.fullName}</div><div className="text-secondary small ltr-value">{student.studentCode}</div></div></Link><StatusBadge {...metaStatus} /></div><div className="d-flex justify-content-between align-items-center text-secondary small mt-3"><span>{student.centerName} · {student.gradeLevel}</span>{can(user, 'students.update') ? <button className="btn p-2" onClick={() => setEditingStudentId(student.id)} aria-label={`تعديل ${student.fullName}`}><Edit3 size={17} /></button> : null}</div></div>;
          })}</div>

          <div className="d-flex align-items-center justify-content-between gap-3 p-3 border-top">
            <span className="text-secondary small">إجمالي {meta?.total ?? students.length} طالب</span>
            <div className="d-flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><Button variant="ghost" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>التالي</Button></div>
          </div>
        </Card>
      ) : null}

      <StudentFormDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <StudentFormDialog open={Boolean(editingStudentId)} studentId={editingStudentId} onClose={() => setEditingStudentId(null)} />
    </>
  );
}
