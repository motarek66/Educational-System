import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, MessageCircle, Plus, Power, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { can } from '../../lib/permissions/can';
import type { ApiResponse, WhatsAppTemplate } from '../../types/api';
import { useAuth } from '../auth/AuthContext';

type TemplateForm = { name: string; type: WhatsAppTemplate['type']; bodyTemplate: string };
const emptyForm: TemplateForm = { name: '', type: 'CUSTOM', bodyTemplate: '' };
const variableLabels = [
  ['student_name', 'اسم الطالب'], ['student_code', 'كود الطالب'], ['grade_level', 'المرحلة'],
  ['center_name', 'السنتر'], ['guardian_name', 'اسم ولي الأمر'],
] as const;
const typeLabels: Record<WhatsAppTemplate['type'], string> = {
  GENERAL: 'عام', GRADE: 'نتيجة', ABSENCE: 'غياب', LATE: 'تأخير', CUSTOM: 'مخصص',
};

function TemplateDialog({ template, open, onClose }: { template: WhatsAppTemplate | null; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) setForm(template ? { name: template.name, type: template.type, bodyTemplate: template.bodyTemplate } : emptyForm);
  }, [open, template]);

  const mutation = useMutation({
    mutationFn: async () => template
      ? api.patch(`/whatsapp/templates/${template.id}`, form)
      : api.post('/whatsapp/templates', form),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] }),
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates', 'manage'] }),
      ]);
      setError(null);
      onClose();
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  const close = () => { if (!mutation.isPending) { dialogRef.current?.close(); onClose(); } };
  const addVariable = (variable: string) => setForm((current) => ({ ...current, bodyTemplate: `${current.bodyTemplate}${current.bodyTemplate ? ' ' : ''}{{${variable}}}` }));

  return (
    <dialog ref={dialogRef} className="border-0 rounded-4 p-0 whatsapp-dialog" onCancel={close}>
      <form className="app-card p-4" style={{ width: 'min(94vw, 720px)' }} onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
          <div><h2 className="h4 mb-1">{template ? 'تعديل قالب واتساب' : 'قالب واتساب جديد'}</h2><p className="text-secondary small mb-0">اكتب الرسالة وأضف المتغيرات التي ستُستبدل تلقائيًا ببيانات الطالب.</p></div>
          <button className="btn p-1" type="button" onClick={close} aria-label="إغلاق"><X /></button>
        </div>
        {error ? <div className="alert alert-danger border-0">{error}</div> : null}
        <div className="row g-3">
          <div className="col-md-8"><label className="form-label">اسم القالب *</label><input required minLength={2} maxLength={100} className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="col-md-4"><label className="form-label">النوع</label><select className="form-select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as WhatsAppTemplate['type'] })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="col-12"><label className="form-label">نص الرسالة *</label><textarea required maxLength={2000} rows={7} className="form-control" value={form.bodyTemplate} onChange={(event) => setForm({ ...form, bodyTemplate: event.target.value })} /></div>
          <div className="col-12"><div className="small text-secondary mb-2">اضغط لإضافة متغير:</div><div className="d-flex flex-wrap gap-2">{variableLabels.map(([variable, label]) => <button className="btn btn-sm btn-outline-secondary" type="button" key={variable} onClick={() => addVariable(variable)}>{label} <code>{`{{${variable}}}`}</code></button>)}</div></div>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-4"><Button type="button" variant="ghost" onClick={close}>إلغاء</Button><Button type="submit" loading={mutation.isPending}>حفظ القالب</Button></div>
      </form>
    </dialog>
  );
}

export function WhatsAppTemplatesManager({ onBack }: { onBack?: () => void } = {}) {
  const { user } = useAuth();
  const allowed = can(user, 'whatsapp.manage_templates');
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const query = useQuery({
    queryKey: ['whatsapp', 'templates', 'manage'],
    queryFn: async () => (await api.get<ApiResponse<WhatsAppTemplate[]>>('/whatsapp/templates/manage')).data.data,
    enabled: allowed,
  });
  const updateMutation = useMutation({
    mutationFn: ({ template, isActive }: { template: WhatsAppTemplate; isActive: boolean }) => api.patch(`/whatsapp/templates/${template.id}`, { isActive }),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] }), queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates', 'manage'] })]),
  });
  const deleteMutation = useMutation({
    mutationFn: (template: WhatsAppTemplate) => api.delete(`/whatsapp/templates/${template.id}`),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates'] }), queryClient.invalidateQueries({ queryKey: ['whatsapp', 'templates', 'manage'] })]),
  });
  if (!allowed) return null;

  return (
    <Card className="panel mt-3" id="whatsapp-templates">
      <div className="panel__header">
        <div><h2 className="panel__title">قوالب واتساب</h2><p className="panel__subtitle">أنشئ رسائل جاهزة تُملأ تلقائيًا من ملف الطالب.</p></div>
        <div className="d-flex align-items-center gap-2">
          {onBack && <Button variant="ghost" onClick={onBack}>العودة للإعدادات</Button>}
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={18} /> قالب جديد</Button>
        </div>
      </div>
      {query.isError ? <div className="alert alert-danger border-0">{getApiErrorMessage(query.error)}</div> : null}
      <div className="d-grid gap-2">
        {query.data?.map((template) => (
          <div className="whatsapp-template-row" key={template.id}>
            <div className="whatsapp-template-row__icon"><MessageCircle size={20} /></div>
            <div className="flex-grow-1 min-width-0"><div className="d-flex gap-2 align-items-center flex-wrap"><strong>{template.name}</strong><StatusBadge label={template.isActive ? 'مفعّل' : 'متوقف'} tone={template.isActive ? 'success' : 'neutral'} /><span className="small text-secondary">{typeLabels[template.type]}</span></div><div className="text-secondary small mt-1 whatsapp-template-row__body">{template.bodyTemplate}</div></div>
            <div className="d-flex gap-1"><button className="btn p-2" title="تعديل" onClick={() => { setEditing(template); setDialogOpen(true); }}><Edit3 size={17} /></button><button className="btn p-2" title={template.isActive ? 'إيقاف' : 'تفعيل'} onClick={() => updateMutation.mutate({ template, isActive: !template.isActive })}><Power size={17} /></button><button className="btn p-2 text-danger" title="حذف" onClick={() => { if (window.confirm(`حذف القالب «${template.name}»؟`)) deleteMutation.mutate(template); }}><Trash2 size={17} /></button></div>
          </div>
        ))}
      </div>
      {!query.isLoading && query.data?.length === 0 ? <div className="text-center text-secondary py-4">لا توجد قوالب بعد.</div> : null}
      <TemplateDialog template={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Card>
  );
}
