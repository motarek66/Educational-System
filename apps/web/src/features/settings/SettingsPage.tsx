import { useQuery } from '@tanstack/react-query';
import { BellRing, CalendarRange, DatabaseBackup, KeyRound, MessageCircle, Save, Settings2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';

type SettingsPayload = {
  organizationName: string;
  timezone: string;
  locale: string;
  defaultCountry: string;
  lateAfterMinutes: number;
  excusedAttendancePolicy: 'EXCLUDE' | 'INCLUDE';
  activeAcademicYear: string | null;
  lastBackupAt: string | null;
};

export function SettingsPage() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<ApiResponse<SettingsPayload>>('/settings')).data.data,
  });

  return (
    <>
      <PageHeader title="إعدادات النظام" subtitle="الإعدادات العامة، السنة الدراسية، قواعد الحضور والقوالب والأمان." actions={<Button><Save size={18} /> حفظ التغييرات</Button>} />
      {query.isError ? <div className="alert alert-danger border-0">{getApiErrorMessage(query.error)}</div> : null}
      <div className="row g-3">
        <div className="col-lg-8">
          <Card className="panel mb-3"><div className="panel__header"><div><h2 className="panel__title">بيانات المؤسسة</h2><p className="panel__subtitle">الاسم والمنطقة الزمنية والإعدادات المحلية</p></div><Settings2 size={20} color="var(--color-primary-600)" /></div><div className="row g-3"><div className="col-md-6"><label className="form-label">اسم المؤسسة</label><input className="form-control" defaultValue={query.data?.organizationName} /></div><div className="col-md-6"><label className="form-label">المنطقة الزمنية</label><input className="form-control ltr-value" defaultValue={query.data?.timezone ?? 'Africa/Cairo'} /></div><div className="col-md-6"><label className="form-label">الدولة الافتراضية للهواتف</label><input className="form-control ltr-value" defaultValue={query.data?.defaultCountry ?? 'EG'} /></div><div className="col-md-6"><label className="form-label">اللغة</label><select className="form-select" defaultValue={query.data?.locale ?? 'ar-EG'}><option value="ar-EG">العربية - مصر</option></select></div></div></Card>
          <Card className="panel"><div className="panel__header"><div><h2 className="panel__title">قواعد الحضور</h2><p className="panel__subtitle">السياسات المستخدمة في المسح والتقارير</p></div><BellRing size={20} color="var(--color-primary-600)" /></div><div className="row g-3"><div className="col-md-6"><label className="form-label">اعتبار الطالب متأخرًا بعد</label><div className="input-group"><input className="form-control ltr-value" type="number" defaultValue={query.data?.lateAfterMinutes ?? 15} /><span className="input-group-text border-secondary-subtle">دقيقة</span></div></div><div className="col-md-6"><label className="form-label">الغياب بعذر في نسبة الحضور</label><select className="form-select" defaultValue={query.data?.excusedAttendancePolicy ?? 'EXCLUDE'}><option value="EXCLUDE">يُستبعد من المقام</option><option value="INCLUDE">يُحسب ضمن الغياب</option></select></div></div></Card>
        </div>
        <div className="col-lg-4"><div className="d-grid gap-3">{[
          { icon: CalendarRange, title: 'السنة الدراسية', description: query.data?.activeAcademicYear ?? 'لم يتم تعيين سنة نشطة' },
          { icon: MessageCircle, title: 'قوالب واتساب', description: 'قوالب النتائج والغياب والتأخير' },
          { icon: KeyRound, title: 'الأدوار والصلاحيات', description: 'إدارة Permissions ونطاقات السناتر' },
          { icon: DatabaseBackup, title: 'النسخ الاحتياطي', description: query.data?.lastBackupAt ? `آخر نسخة: ${query.data.lastBackupAt}` : 'لم تُسجل نسخة بعد' },
        ].map(({ icon: Icon, title, description }) => <Card className="panel" key={title}><div className="d-flex align-items-center gap-3"><div className="metric-card__icon"><Icon size={20} /></div><div><div className="fw-semibold">{title}</div><div className="text-secondary small mt-1">{description}</div></div></div><Button variant="ghost" className="w-100 mt-3">إدارة</Button></Card>)}</div></div>
      </div>
    </>
  );
}
