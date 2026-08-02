import { useQuery } from '@tanstack/react-query';
import { ExternalLink, MessageCircle, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse, StudentProfile, WhatsAppPreview, WhatsAppTemplate } from '../../types/api';

type Recipient = { id: string; label: string; phone: string };

export function WhatsAppDialog({
  student,
  open,
  onClose,
}: {
  student: StudentProfile;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const recipients = useMemo<Recipient[]>(() => {
    const items: Recipient[] = [];
    if (student.studentPhone) {
      items.push({ id: 'student', label: `الطالب: ${student.fullName}`, phone: student.studentPhone });
    }
    student.guardians.forEach((guardian) => {
      const phone = guardian.whatsappPhoneE164 ?? guardian.phoneE164;
      if (phone) items.push({ id: guardian.id, label: `ولي الأمر: ${guardian.fullName}`, phone });
    });
    return items;
  }, [student]);
  const [templateId, setTemplateId] = useState('');
  const [recipientId, setRecipientId] = useState('');

  const templatesQuery = useQuery({
    queryKey: ['whatsapp', 'templates'],
    queryFn: async () => (await api.get<ApiResponse<WhatsAppTemplate[]>>('/whatsapp/templates')).data.data,
    enabled: open,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!recipientId && recipients[0]) setRecipientId(recipients[0].id);
    if (!templateId && templatesQuery.data?.[0]) setTemplateId(templatesQuery.data[0].id);
  }, [open, recipientId, recipients, templateId, templatesQuery.data]);

  const selectedRecipient = recipients.find((item) => item.id === recipientId);
  const primaryGuardian = student.guardians.find((guardian) => guardian.isPrimary) ?? student.guardians[0];
  const previewQuery = useQuery({
    queryKey: ['whatsapp', 'preview', templateId, selectedRecipient?.phone, student.id],
    queryFn: async () => (await api.post<ApiResponse<WhatsAppPreview>>('/whatsapp/preview', {
      templateId,
      phoneE164: selectedRecipient?.phone,
      variables: {
        student_name: student.fullName,
        student_code: student.studentCode,
        grade_level: student.gradeLevel,
        center_name: student.centerName,
        guardian_name: primaryGuardian?.fullName ?? '',
      },
    })).data.data,
    enabled: open && Boolean(templateId && selectedRecipient?.phone),
    retry: false,
  });

  const close = () => {
    dialogRef.current?.close();
    onClose();
  };

  const openWhatsApp = () => {
    if (!previewQuery.data?.url) return;
    window.open(previewQuery.data.url, '_blank', 'noopener,noreferrer');
    close();
  };

  return (
    <dialog ref={dialogRef} className="border-0 rounded-4 p-0 whatsapp-dialog" onCancel={close} onClose={onClose}>
      <div className="app-card p-4" style={{ width: 'min(94vw, 680px)' }}>
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h4 mb-1">إرسال رسالة واتساب</h2>
            <p className="text-secondary small mb-0">اختر المستلم والقالب، ثم راجع الرسالة قبل فتح واتساب.</p>
          </div>
          <button className="btn p-1" type="button" onClick={close} aria-label="إغلاق"><X /></button>
        </div>

        {recipients.length === 0 ? (
          <div className="alert alert-warning border-0">لا يوجد رقم للطالب أو ولي الأمر. أضف رقمًا صحيحًا أولًا.</div>
        ) : null}
        {templatesQuery.isError ? <div className="alert alert-danger border-0">{getApiErrorMessage(templatesQuery.error)}</div> : null}

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label">المستلم</label>
            <select className="form-select" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} disabled={recipients.length === 0}>
              {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.label} — {recipient.phone}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">قالب الرسالة</label>
            <select className="form-select" value={templateId} onChange={(event) => setTemplateId(event.target.value)} disabled={templatesQuery.isLoading || !templatesQuery.data?.length}>
              {templatesQuery.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0">معاينة الرسالة</label>
              <Link to="/settings#whatsapp-templates" className="small" onClick={close}>إدارة القوالب</Link>
            </div>
            {previewQuery.isLoading ? <div className="skeleton rounded-3" style={{ height: 140 }} /> : null}
            {previewQuery.isError ? <div className="alert alert-danger border-0 mb-0">{getApiErrorMessage(previewQuery.error)}</div> : null}
            {previewQuery.data ? <textarea className="form-control whatsapp-preview" rows={6} readOnly value={previewQuery.data.message} /> : null}
            {!templatesQuery.isLoading && templatesQuery.data?.length === 0 ? <div className="alert alert-info border-0 mb-0">لا توجد قوالب مفعّلة. أنشئ قالبًا من الإعدادات.</div> : null}
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={close}>إلغاء</Button>
          <Button type="button" onClick={openWhatsApp} disabled={!previewQuery.data?.url} loading={previewQuery.isFetching}>
            <MessageCircle size={18} /> فتح واتساب <ExternalLink size={15} />
          </Button>
        </div>
        <p className="text-secondary small mt-3 mb-0">ستُفتح الرسالة مكتوبة داخل واتساب، ثم تضغط إرسال من واتساب.</p>
      </div>
    </dialog>
  );
}
