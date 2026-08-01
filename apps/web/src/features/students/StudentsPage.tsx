import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, MoreHorizontal, Plus, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchField } from '../../components/ui/SearchField';
import { StatusBadge, studentStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse, StudentListItem } from '../../types/api';

type PaginatedStudents = ApiResponse<StudentListItem[]>;

type CreateStudentInput = {
  fullName: string;
  gradeLevel: string;
  centerId: string;
  guardianName: string;
  guardianPhone: string;
};

type SelectOption = { id: string; name: string; code?: string };

function AddStudentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CreateStudentInput>({
    fullName: '', gradeLevel: '', centerId: '', guardianName: '', guardianPhone: '',
  });
  const [error, setError] = useState<string | null>(null);

  const centersQuery = useQuery({
    queryKey: ['centers', 'options'],
    queryFn: async () => (await api.get<ApiResponse<SelectOption[]>>('/centers/options')).data.data,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/students', form)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      setForm({ fullName: '', gradeLevel: '', centerId: '', guardianName: '', guardianPhone: '' });
      onClose();
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const update = (key: keyof CreateStudentInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (!mutation.isPending) {
      dialogRef.current?.close();
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className="border-0 rounded-4 p-0" onCancel={close}>
      <form
        className="app-card p-4"
        style={{ width: 'min(94vw, 720px)' }}
        onSubmit={(event) => { event.preventDefault(); setError(null); mutation.mutate(); }}
      >
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div><h2 className="h4 mb-1">إضافة طالب جديد</h2><p className="text-secondary small mb-0">سيتم إنشاء كود وQR آمن تلقائيًا.</p></div>
          <button className="btn p-1" type="button" onClick={close} aria-label="إغلاق"><X /></button>
        </div>
        {error ? <div className="alert alert-danger border-0">{error}</div> : null}
        <div className="row g-3">
          <div className="col-md-8"><label className="form-label">اسم الطالب *</label><input required className="form-control" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} /></div>
          <div className="col-md-4"><label className="form-label">الصف الدراسي *</label><input required className="form-control" value={form.gradeLevel} onChange={(e) => update('gradeLevel', e.target.value)} placeholder="الثالث الإعدادي" /></div>
          <div className="col-md-6"><label className="form-label">السنتر *</label><select required className="form-select" value={form.centerId} onChange={(e) => update('centerId', e.target.value)}><option value="">اختر السنتر</option>{centersQuery.data?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label">اسم ولي الأمر *</label><input required className="form-control" value={form.guardianName} onChange={(e) => update('guardianName', e.target.value)} /></div>
          <div className="col-md-6"><label className="form-label">رقم ولي الأمر *</label><input required className="form-control ltr-value" value={form.guardianPhone} onChange={(e) => update('guardianPhone', e.target.value)} placeholder="+2010..." /></div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={close}>إلغاء</Button>
          <Button type="submit" loading={mutation.isPending}>حفظ وإنشاء الكود</Button>
        </div>
      </form>
    </dialog>
  );
}

export function StudentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const query = useQuery({
    queryKey: ['students', { search, status, page }],
    queryFn: async () => (await api.get<PaginatedStudents>('/students', { params: { search: search || undefined, status: status || undefined, page, limit: 10 } })).data,
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
        <div className="toolbar__filters">
          <select className="form-select" style={{ minWidth: 150 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">كل الحالات</option><option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option><option value="WITHDRAWN">منسحب</option><option value="SUSPENDED">موقوف</option>
          </select>
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
                return <tr key={student.id}><td><div className="d-flex align-items-center gap-3"><div className="sidebar__brand-mark" style={{ width: 38, height: 38 }}>{student.fullName.slice(0, 1)}</div><div><div className="fw-semibold">{student.fullName}</div><div className="text-secondary small">{student.gradeLevel}</div></div></div></td><td><span className="ltr-value d-inline-block fw-medium">{student.studentCode}</span></td><td><div>{student.centerName}</div></td><td><span className="ltr-value d-inline-block">{student.guardianPhone ?? '—'}</span></td><td><StatusBadge {...metaStatus} /></td><td><div className="d-flex gap-1"><Link className="btn p-2" to={`/students/${student.id}`} aria-label={`عرض ${student.fullName}`}><Eye size={18} /></Link><button className="btn p-2" aria-label="المزيد"><MoreHorizontal size={18} /></button></div></td></tr>;
              })}</tbody>
            </table>
          </div>

          <div className="data-card-list p-3">{students.map((student) => {
            const metaStatus = studentStatusMeta[student.status];
            return <Link to={`/students/${student.id}`} key={student.id} className="rounded-3 p-3" style={{ background: 'var(--surface-subtle)' }}><div className="d-flex align-items-start justify-content-between gap-2"><div className="d-flex gap-3"><div className="sidebar__brand-mark">{student.fullName.slice(0, 1)}</div><div><div className="fw-semibold">{student.fullName}</div><div className="text-secondary small ltr-value">{student.studentCode}</div></div></div><StatusBadge {...metaStatus} /></div><div className="d-flex justify-content-between text-secondary small mt-3"><span>{student.centerName}</span><span>{student.gradeLevel}</span></div></Link>;
          })}</div>

          <div className="d-flex align-items-center justify-content-between gap-3 p-3 border-top">
            <span className="text-secondary small">إجمالي {meta?.total ?? students.length} طالب</span>
            <div className="d-flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><Button variant="ghost" disabled={page >= (meta?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>التالي</Button></div>
          </div>
        </Card>
      ) : null}

      <AddStudentDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
