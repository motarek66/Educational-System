import { useQuery } from '@tanstack/react-query';
import {
  BellRing,
  CalendarRange,
  CheckCircle2,
  DatabaseBackup,
  KeyRound,
  MessageSquare,
  Save,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';
import { WhatsAppTemplatesManager } from '../whatsapp/WhatsAppTemplatesManager';
import { AcademicYearsManager } from './AcademicYearsManager';
import { BackupManager } from './BackupManager';
import { RolesPermissionsManager } from './RolesPermissionsManager';

type SettingsTab = 'GENERAL' | 'ACADEMIC_YEARS' | 'ROLES' | 'BACKUP' | 'WHATSAPP';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // General Settings State
  const [orgName, setOrgName] = useState('منصة متابعة الطلاب');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [defaultCountry, setDefaultCountry] = useState('EG');
  const [locale, setLocale] = useState('ar-EG');

  // Enhanced Attendance Rules State
  const [lateGraceMinutes, setLateGraceMinutes] = useState(14);
  const [absentAfterMinutes, setAbsentAfterMinutes] = useState(45);
  const [excusedAffectsRate, setExcusedAffectsRate] = useState<'EXCLUDE' | 'INCLUDE'>('EXCLUDE');
  const [unexcusedAffectsRate, setUnexcusedAffectsRate] = useState<'YES' | 'NO'>('YES');

  // Early Leave
  const [earlyLeaveEnabled, setEarlyLeaveEnabled] = useState(true);
  const [earlyLeaveMinutes, setEarlyLeaveMinutes] = useState(15);

  // Convert late to absence
  const [convertLateEnabled, setConvertLateEnabled] = useState(true);
  const [lateCountForAbsence, setLateCountForAbsence] = useState(3);

  // Attendance edit time limit
  const [editLimitPolicy, setEditLimitPolicy] = useState<
    'SAME_DAY' | 'THREE_DAYS' | 'SEVEN_DAYS' | 'CUSTOM' | 'UNLIMITED'
  >('SEVEN_DAYS');
  const [customEditLimitDays, setCustomEditLimitDays] = useState(14);

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<ApiResponse<SettingsPayload>>('/settings')).data.data,
  });

  const handleSaveAll = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <>
      <PageHeader
        title="إعدادات النظام"
        subtitle="الإعدادات العامة، السنة الدراسية، الأدوار والصلاحيات، النسخ الاحتياطي وقواعد الحضور وقوالب واتساب."
        actions={
          activeTab === 'GENERAL' ? (
            <Button onClick={handleSaveAll}>
              <Save size={18} /> حفظ التغييرات
            </Button>
          ) : undefined
        }
      />

      {saveSuccess && (
        <div className="alert alert-success d-flex align-items-center gap-2 border-0 shadow-sm mb-3">
          <CheckCircle2 size={18} className="text-success" />
          <span>تم حفظ كافة إعدادات النظام وقواعد الحضور بنجاح.</span>
        </div>
      )}

      {query.isError ? (
        <div className="alert alert-danger border-0 mb-3">{getApiErrorMessage(query.error)}</div>
      ) : null}

      <div className="d-flex align-items-center gap-2 mb-4 border-bottom pb-2 flex-wrap">
        <button
          type="button"
          className={`btn ${
            activeTab === 'GENERAL' ? 'btn-primary' : 'btn-light'
          } rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2`}
          onClick={() => setActiveTab('GENERAL')}
        >
          <Settings2 size={16} />
          <span>العامة وقواعد الحضور</span>
        </button>

        <button
          type="button"
          className={`btn ${
            activeTab === 'ACADEMIC_YEARS' ? 'btn-primary' : 'btn-light'
          } rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2`}
          onClick={() => setActiveTab('ACADEMIC_YEARS')}
        >
          <CalendarRange size={16} />
          <span>السنة الدراسية</span>
        </button>

        <button
          type="button"
          className={`btn ${
            activeTab === 'ROLES' ? 'btn-primary' : 'btn-light'
          } rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2`}
          onClick={() => setActiveTab('ROLES')}
        >
          <KeyRound size={16} />
          <span>الأدوار والصلاحيات</span>
        </button>

        <button
          type="button"
          className={`btn ${
            activeTab === 'BACKUP' ? 'btn-primary' : 'btn-light'
          } rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2`}
          onClick={() => setActiveTab('BACKUP')}
        >
          <DatabaseBackup size={16} />
          <span>النسخ الاحتياطي وDrive</span>
        </button>

        <button
          type="button"
          className={`btn ${
            activeTab === 'WHATSAPP' ? 'btn-primary' : 'btn-light'
          } rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2`}
          onClick={() => setActiveTab('WHATSAPP')}
        >
          <MessageSquare size={16} />
          <span>قوالب واتساب</span>
        </button>
      </div>

      {activeTab === 'GENERAL' && (
        <div className="row g-3">
          <div className="col-lg-8">
            <Card className="panel mb-3">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title">بيانات المؤسسة</h2>
                  <p className="panel__subtitle">الاسم والمنطقة الزمنية والإعدادات المحلية</p>
                </div>
                <Settings2 size={20} color="var(--color-primary-600)" />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">اسم المؤسسة</label>
                  <input
                    className="form-control"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">المنطقة الزمنية</label>
                  <input
                    className="form-control ltr-value"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">الدولة الافتراضية للهواتف</label>
                  <input
                    className="form-control ltr-value"
                    value={defaultCountry}
                    onChange={(e) => setDefaultCountry(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">اللغة</label>
                  <select
                    className="form-select"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    <option value="ar-EG">العربية - جمهورية مصر العربية</option>
                    <option value="ar-SA">العربية - المملكة العربية السعودية</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="panel mb-3">
              <div className="panel__header">
                <div>
                  <h2 className="panel__title">قواعد وسياسات الحضور والانصراف</h2>
                  <p className="panel__subtitle">
                    السياسات المستخدمة في مسح الباركود، احتساب التأخير والغياب، الخروج المبكر، وتعديل السجلات
                  </p>
                </div>
                <BellRing size={20} color="var(--color-primary-600)" />
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">فترة السماح قبل اعتبار الطالب متأخرًا</label>
                  <div className="input-group">
                    <input
                      className="form-control ltr-value text-center"
                      type="number"
                      min={0}
                      max={60}
                      value={lateGraceMinutes}
                      onChange={(e) => setLateGraceMinutes(Number(e.target.value))}
                    />
                    <span className="input-group-text border-secondary-subtle">دقيقة</span>
                  </div>
                  <small className="text-secondary">مثال: 14 دقيقة بعد بدء موعد الحصة</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label">يعتبر الطالب غائبًا بعد مرور</label>
                  <div className="input-group">
                    <input
                      className="form-control ltr-value text-center"
                      type="number"
                      min={15}
                      max={180}
                      value={absentAfterMinutes}
                      onChange={(e) => setAbsentAfterMinutes(Number(e.target.value))}
                    />
                    <span className="input-group-text border-secondary-subtle">دقيقة</span>
                  </div>
                  <small className="text-secondary">يتم تحويل الحالة تلقائيًا إلى غائب</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label">الغياب بعذر يؤثر على نسبة الحضور</label>
                  <select
                    className="form-select"
                    value={excusedAffectsRate}
                    onChange={(e) => setExcusedAffectsRate(e.target.value as any)}
                  >
                    <option value="EXCLUDE">لا يؤثر (يُستبعد من المقام)</option>
                    <option value="INCLUDE">نعم (يُحسب ضمن نسبة الغياب)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">الغياب بدون عذر يؤثر على نسبة الحضور</label>
                  <select
                    className="form-select"
                    value={unexcusedAffectsRate}
                    onChange={(e) => setUnexcusedAffectsRate(e.target.value as any)}
                  >
                    <option value="YES">نعم (يقلل نسبة الحضور)</option>
                    <option value="NO">لا</option>
                  </select>
                </div>

                <div className="col-12">
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div>
                        <span className="fw-bold text-dark">احتساب الخروج المبكر</span>
                        <div className="text-secondary small">
                          تسجيل حالات مغادرة الطالب قبل موعد نهاية اليوم
                        </div>
                      </div>
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="earlyLeaveSwitch"
                          checked={earlyLeaveEnabled}
                          onChange={(e) => setEarlyLeaveEnabled(e.target.checked)}
                        />
                      </div>
                    </div>

                    {earlyLeaveEnabled && (
                      <div className="row g-2 align-items-center mt-1 pt-2 border-top">
                        <div className="col-auto">
                          <span className="small text-secondary">
                            يعتبر خروجًا مبكرًا عند المغادرة قبل نهاية اليوم بـ:
                          </span>
                        </div>
                        <div className="col-auto">
                          <div className="input-group input-group-sm" style={{ width: '130px' }}>
                            <input
                              type="number"
                              className="form-control ltr-value text-center"
                              value={earlyLeaveMinutes}
                              min={5}
                              max={120}
                              onChange={(e) => setEarlyLeaveMinutes(Number(e.target.value))}
                            />
                            <span className="input-group-text">دقيقة</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12">
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div>
                        <span className="fw-bold text-dark">تحويل التأخير إلى غياب</span>
                        <div className="text-secondary small">
                          احتساب كل عدد محدد من مرات التأخير كيوم غياب كامل
                        </div>
                      </div>
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="convertLateSwitch"
                          checked={convertLateEnabled}
                          onChange={(e) => setConvertLateEnabled(e.target.checked)}
                        />
                      </div>
                    </div>

                    {convertLateEnabled && (
                      <div className="row g-2 align-items-center mt-1 pt-2 border-top">
                        <div className="col-auto">
                          <span className="small text-secondary">القاعدة:</span>
                        </div>
                        <div className="col-auto">
                          <div className="input-group input-group-sm" style={{ width: '120px' }}>
                            <input
                              type="number"
                              className="form-control ltr-value text-center"
                              value={lateCountForAbsence}
                              min={2}
                              max={10}
                              onChange={(e) => setLateCountForAbsence(Number(e.target.value))}
                            />
                            <span className="input-group-text">مرات</span>
                          </div>
                        </div>
                        <div className="col-auto">
                          <span className="small fw-semibold text-primary">= يوم غياب كامل</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label">مدة السماح بتعديل سجلات الحضور</label>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <select
                      className="form-select"
                      style={{ maxWidth: '280px' }}
                      value={editLimitPolicy}
                      onChange={(e) => setEditLimitPolicy(e.target.value as any)}
                    >
                      <option value="SAME_DAY">نفس اليوم فقط</option>
                      <option value="THREE_DAYS">خلال 3 أيام</option>
                      <option value="SEVEN_DAYS">خلال 7 أيام</option>
                      <option value="CUSTOM">مدة مخصصة</option>
                      <option value="UNLIMITED">بدون حد زمني</option>
                    </select>

                    {editLimitPolicy === 'CUSTOM' && (
                      <div className="input-group" style={{ width: '140px' }}>
                        <input
                          type="number"
                          className="form-control ltr-value text-center"
                          value={customEditLimitDays}
                          min={1}
                          max={90}
                          onChange={(e) => setCustomEditLimitDays(Number(e.target.value))}
                        />
                        <span className="input-group-text">يوم</span>
                      </div>
                    )}
                  </div>
                  <small className="text-secondary">
                    يمنع المشرفين من تغيير حالة الحضور بعد انقضاء هذه المدة ما لم يمنحهم المدير إذناً خاصاً.
                  </small>
                </div>
              </div>
            </Card>
          </div>

          <div className="col-lg-4">
            <div className="d-grid gap-3">
              {[
                {
                  tab: 'ACADEMIC_YEARS' as SettingsTab,
                  icon: CalendarRange,
                  title: 'السنة الدراسية',
                  description: 'السنة النشطة الحالية: 2026/2027 (فصلان دراسيان)',
                  badge: '2026/2027',
                },
                {
                  tab: 'ROLES' as SettingsTab,
                  icon: KeyRound,
                  title: 'الأدوار والصلاحيات',
                  description: 'إدارة 5 أدوار وPermissions ونطاقات السناتر',
                  badge: '5 أدوار',
                },
                {
                  tab: 'BACKUP' as SettingsTab,
                  icon: DatabaseBackup,
                  title: 'النسخ الاحتياطي',
                  description: 'Google Drive: متصل ✅ | آخر نسخة: 24 أغسطس 2026',
                  badge: 'Google Drive متصل',
                },
                {
                  tab: 'WHATSAPP' as SettingsTab,
                  icon: MessageSquare,
                  title: 'قوالب واتساب',
                  description: 'إدارة 5 قوالب ذكية مع Triggers ومعاينة حية',
                  badge: '5 قوالب',
                },
              ].map(({ tab, icon: Icon, title, description, badge }) => (
                <Card className="panel" key={title}>
                  <div className="d-flex align-items-start gap-3">
                    <div className="metric-card__icon">
                      <Icon size={20} />
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="fw-semibold">{title}</span>
                        <span className="badge bg-primary-subtle text-primary small">{badge}</span>
                      </div>
                      <div className="text-secondary small mt-1">{description}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-100 mt-3 border"
                    onClick={() => setActiveTab(tab)}
                  >
                    إدارة
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ACADEMIC_YEARS' && (
        <AcademicYearsManager onBack={() => setActiveTab('GENERAL')} />
      )}

      {activeTab === 'ROLES' && (
        <RolesPermissionsManager onBack={() => setActiveTab('GENERAL')} />
      )}

      {activeTab === 'BACKUP' && <BackupManager onBack={() => setActiveTab('GENERAL')} />}

      {activeTab === 'WHATSAPP' && (
        <WhatsAppTemplatesManager onBack={() => setActiveTab('GENERAL')} />
      )}
    </>
  );
}
