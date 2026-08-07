import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse, StudentProfile } from '../../types/api';

const GRADE_LEVELS = [
  'الأول الابتدائي',
  'الثاني الابتدائي',
  'الثالث الابتدائي',
  'الرابع الابتدائي',
  'الخامس الابتدائي',
  'السادس الابتدائي',
  'الأول الإعدادي',
  'الثاني الإعدادي',
  'الثالث الإعدادي',
  'الأول الثانوي',
  'الثاني الثانوي',
  'الثالث الثانوي',
] as const;

type StudentForm = {
  fullName: string;
  gradeLevel: string;
  centerId: string;
  guardianName: string;
  guardianPhone: string;
  studentPhone: string;
  status: StudentProfile['status'];
};

type SelectOption = { id: string; name: string };
type EditableStudentProfile = StudentProfile & { centerId: string | null };

const emptyForm: StudentForm = {
  fullName: '',
  gradeLevel: '',
  centerId: '',
  guardianName: '',
  guardianPhone: '',
  studentPhone: '',
  status: 'ACTIVE',
};

export function StudentFormDialog({
  open,
  studentId,
  onClose,
}: {
  open: boolean;
  studentId?: string | null;
  onClose: () => void;
}) {
  const editing = Boolean(studentId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const centersQuery = useQuery({
    queryKey: ['centers', 'options'],
    queryFn: async () => (await api.get<ApiResponse<SelectOption[]>>('/centers/options')).data.data,
    enabled: open,
  });
  const studentQuery = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => (await api.get<ApiResponse<EditableStudentProfile>>(`/students/${studentId}/profile`)).data.data,
    enabled: open && editing,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm(emptyForm);
      setError(null);
      return;
    }
    const student = studentQuery.data;
    if (!student) return;
    const guardian = student.guardians.find((item) => item.isPrimary) ?? student.guardians[0];
    setForm({
      fullName: student.fullName,
      gradeLevel: student.gradeLevel,
      centerId: student.centerId ?? '',
      guardianName: guardian?.fullName ?? '',
      guardianPhone: guardian?.phoneE164 ?? '',
      studentPhone: student.studentPhone ?? '',
      status: student.status,
    });
    setError(null);
  }, [editing, open, studentQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => editing
      ? (await api.patch(`/students/${studentId}`, form)).data
      : (await api.post('/students', form)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['student', studentId] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      onClose();
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  const update = <K extends keyof StudentForm>(key: K, value: StudentForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const close = () => {
    if (!mutation.isPending) onClose();
  };

  return (
    <dialog ref={dialogRef} className="student-form-dialog border-0 rounded-4 p-0" onCancel={close} onClose={onClose}>
      <form
        className="app-card p-4"
        style={{ width: 'min(94vw, 760px)' }}
        onSubmit={(event) => { event.preventDefault(); setError(null); mutation.mutate(); }}
      >
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h4 mb-1">{editing ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h2>
            <p className="text-secondary small mb-0">{editing ? 'يمكنك تعديل البيانات والحالة من هنا.' : 'سيتم إنشاء كود وQR آمن تلقائيًا.'}</p>
          </div>
          <button className="btn p-1" type="button" onClick={close} aria-label="إغلاق"><X /></button>
        </div>

        {error ? <div className="alert alert-danger border-0">{error}</div> : null}
        {editing && studentQuery.isLoading ? <div className="skeleton rounded-3" style={{ height: 280 }} /> : (
          <div className="row g-3">
            <div className="col-md-8"><label className="form-label">اسم الطالب *</label><input required minLength={3} className="form-control" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></div>
            <div className="col-md-4"><label className="form-label">الحالة *</label><select className="form-select" value={form.status} onChange={(event) => update('status', event.target.value as StudentForm['status'])}><option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option>{editing ? <><option value="WITHDRAWN">منسحب</option><option value="SUSPENDED">موقوف</option></> : null}</select></div>
            <div className="col-md-6"><label className="form-label">المرحلة الدراسية *</label><select required className="form-select" value={form.gradeLevel} onChange={(event) => update('gradeLevel', event.target.value)}><option value="">اختر المرحلة</option>{GRADE_LEVELS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">السنتر *</label><select required className="form-select" value={form.centerId} onChange={(event) => update('centerId', event.target.value)}><option value="">اختر السنتر</option>{centersQuery.data?.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">رقم الطالب</label><input className="form-control ltr-value" value={form.studentPhone} onChange={(event) => update('studentPhone', event.target.value)} placeholder="+2010..." /></div>
            <div className="col-md-6"><label className="form-label">اسم ولي الأمر *</label><input required minLength={3} className="form-control" value={form.guardianName} onChange={(event) => update('guardianName', event.target.value)} /></div>
            <div className="col-md-6"><label className="form-label">رقم ولي الأمر *</label><input required minLength={8} className="form-control ltr-value" value={form.guardianPhone} onChange={(event) => update('guardianPhone', event.target.value)} placeholder="+2010..." /></div>
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={close}>إلغاء</Button>
          <Button type="submit" loading={mutation.isPending} disabled={editing && studentQuery.isLoading}>{editing ? 'حفظ التعديلات' : 'حفظ وإنشاء الكود'}</Button>
        </div>
      </form>
    </dialog>
  );
}
