import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatNumber } from '../../lib/formatting';
import type { ApiResponse, CenterListItem } from '../../types/api';

type CreateCenterInput = {
  name: string;
  code: string;
  address: string;
};

const emptyCenter: CreateCenterInput = { name: '', code: '', address: '' };

function AddCenterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CreateCenterInput>(emptyCenter);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/centers', {
      name: form.name.trim(),
      code: form.code.trim(),
      address: form.address.trim() || undefined,
    })).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['centers'] }),
        queryClient.invalidateQueries({ queryKey: ['centers', 'options'] }),
      ]);
      setForm(emptyCenter);
      setError(null);
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

  const update = (key: keyof CreateCenterInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (!mutation.isPending) {
      dialogRef.current?.close();
      setError(null);
      onClose();
    }
  };

  return (
    <dialog ref={dialogRef} className="border-0 rounded-4 p-0" onCancel={close}>
      <form
        className="app-card p-4"
        style={{ width: 'min(94vw, 620px)' }}
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h4 mb-1">إضافة سنتر جديد</h2>
            <p className="text-secondary small mb-0">أدخل بيانات السنتر الأساسية ثم أضف الطلاب إليه.</p>
          </div>
          <button className="btn p-1" type="button" onClick={close} aria-label="إغلاق"><X /></button>
        </div>
        {error ? <div className="alert alert-danger border-0">{error}</div> : null}
        <div className="row g-3">
          <div className="col-md-8">
            <label className="form-label">اسم السنتر *</label>
            <input required className="form-control" value={form.name} onChange={(event) => update('name', event.target.value)} autoFocus />
          </div>
          <div className="col-md-4">
            <label className="form-label">كود السنتر *</label>
            <input required className="form-control ltr-value" value={form.code} onChange={(event) => update('code', event.target.value)} placeholder="CTR-01" />
          </div>
          <div className="col-12">
            <label className="form-label">العنوان</label>
            <input className="form-control" value={form.address} onChange={(event) => update('address', event.target.value)} />
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={close}>إلغاء</Button>
          <Button type="submit" loading={mutation.isPending}>حفظ السنتر</Button>
        </div>
      </form>
    </dialog>
  );
}

export function CentersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const query = useQuery({
    queryKey: ['centers'],
    queryFn: async () => (await api.get<ApiResponse<CenterListItem[]>>('/centers')).data.data,
  });

  return (
    <>
      <PageHeader title="السناتر" subtitle="نظم أماكن الدراسة واعرض طلاب كل سنتر." actions={<Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة سنتر</Button>} />
      {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? <Card className="skeleton" style={{ height: 420 }} /> : null}
      {!query.isLoading && !query.isError && query.data?.length === 0 ? <EmptyState title="لا توجد سناتر" description="أضف أول سنتر ثم سجّل الطلاب داخله." action={<Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة سنتر</Button>} /> : null}
      <div className="row g-3">{query.data?.map((center) => <div className="col-lg-6 col-xl-4" key={center.id}><Card className="panel h-100"><div className="d-flex align-items-start justify-content-between gap-3"><div className="d-flex align-items-center gap-3"><div className="metric-card__icon"><Building2 size={20} /></div><div><h2 className="h5 mb-1">{center.name}</h2><div className="text-secondary small ltr-value">{center.code}</div></div></div><StatusBadge label={center.status === 'ACTIVE' ? 'نشط' : 'غير نشط'} tone={center.status === 'ACTIVE' ? 'success' : 'warning'} /></div><p className="text-secondary small mt-3 mb-0"><MapPin size={15} className="ms-1" />{center.address ?? 'لا يوجد عنوان مسجل'}</p><div className="rounded-3 p-3 mt-3" style={{ background: 'var(--surface-subtle)' }}><Users size={18} color="var(--color-primary-600)" /><div className="text-secondary small mt-2">الطلاب</div><strong>{formatNumber(center.studentsCount)}</strong></div><Link className="app-button app-button--secondary w-100 mt-3" to={`/centers/${center.id}`}>عرض السنتر</Link></Card></div>)}</div>
      <AddCenterDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
