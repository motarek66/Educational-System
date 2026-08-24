import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileArchive,
  HardDriveDownload,
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';

export type BackupItem = {
  id: string;
  filename: string;
  createdAt: string;
  sizeMb: number;
  source: 'MANUAL' | 'AUTOMATIC';
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  driveStatus: 'UPLOADED' | 'NOT_UPLOADED' | 'FAILED' | 'UPLOADING';
  localAvailable: boolean;
  metadata?: {
    appVersion: string;
    dbVersion: string;
    organizationId: string;
    backupVersion: string;
    tablesCount: number;
  };
};

const initialBackups: BackupItem[] = [
  {
    id: 'b-01',
    filename: 'backup-2026-08-24-0200.zip',
    createdAt: '24 أغسطس 2026 - 02:00',
    sizeMb: 240,
    source: 'AUTOMATIC',
    status: 'SUCCESS',
    driveStatus: 'UPLOADED',
    localAvailable: true,
    metadata: {
      appVersion: 'v1.4.2',
      dbVersion: 'v2.1',
      organizationId: 'org-default',
      backupVersion: '2.0',
      tablesCount: 28,
    },
  },
  {
    id: 'b-02',
    filename: 'backup-2026-08-23-1422.zip',
    createdAt: '23 أغسطس 2026 - 14:22',
    sizeMb: 238,
    source: 'MANUAL',
    status: 'SUCCESS',
    driveStatus: 'NOT_UPLOADED',
    localAvailable: true,
    metadata: {
      appVersion: 'v1.4.2',
      dbVersion: 'v2.1',
      organizationId: 'org-default',
      backupVersion: '2.0',
      tablesCount: 28,
    },
  },
  {
    id: 'b-03',
    filename: 'backup-2026-08-22-0200.zip',
    createdAt: '22 أغسطس 2026 - 02:00',
    sizeMb: 235,
    source: 'AUTOMATIC',
    status: 'SUCCESS',
    driveStatus: 'FAILED',
    localAvailable: true,
    metadata: {
      appVersion: 'v1.4.1',
      dbVersion: 'v2.1',
      organizationId: 'org-default',
      backupVersion: '2.0',
      tablesCount: 28,
    },
  },
  {
    id: 'b-04',
    filename: 'backup-2026-08-21-0200.zip',
    createdAt: '21 أغسطس 2026 - 02:00',
    sizeMb: 232,
    source: 'AUTOMATIC',
    status: 'SUCCESS',
    driveStatus: 'UPLOADED',
    localAvailable: true,
    metadata: {
      appVersion: 'v1.4.1',
      dbVersion: 'v2.1',
      organizationId: 'org-default',
      backupVersion: '2.0',
      tablesCount: 28,
    },
  },
];

export function BackupManager({ onBack }: { onBack?: () => void }) {
  const [backups, setBackups] = useState<BackupItem[]>(initialBackups);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [uploadAlsoToDrive, setUploadAlsoToDrive] = useState(true);
  const [recentlyCreatedBackup, setRecentlyCreatedBackup] = useState<BackupItem | null>(null);

  // Auto-backup configuration state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [backupTime, setBackupTime] = useState('02:00');
  const [retentionPolicy, setRetentionPolicy] = useState('30');
  const [customRetentionDays, setCustomRetentionDays] = useState('60');

  // Google Drive Cloud state
  const [driveConnected, setDriveConnected] = useState(true);
  const [driveAccount, setDriveAccount] = useState<{
    name: string;
    email: string;
    lastUploadAt: string;
    folderName: string;
    quotaUsed: string;
    quotaTotal: string;
  }>({
    name: 'أكاديمية التعليم المتقدم',
    email: 'school.backup.admin@gmail.com',
    lastUploadAt: '24 أغسطس 2026 - 02:00',
    folderName: 'Student Platform Backups/2026/August',
    quotaUsed: '4.2 GB',
    quotaTotal: '15 GB',
  });
  const [driveExpired] = useState(false);
  const [autoUploadToDrive, setAutoUploadToDrive] = useState(true);

  // OAuth Simulation Modal
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [oauthStep, setOauthStep] = useState<'SELECT_ACCOUNT' | 'PERMISSIONS' | 'CONNECTING' | 'DONE'>('SELECT_ACCOUNT');
  const [oauthEmailInput, setOauthEmailInput] = useState('new.account@gmail.com');

  // Restore Modal State
  const [restoreModal, setRestoreModal] = useState<{
    open: boolean;
    backup: BackupItem | null;
    isFromDrive?: boolean;
    confirmationText: string;
    step: 'CONFIRM' | 'VALIDATING' | 'RESTORING' | 'SUCCESS';
  }>({
    open: false,
    backup: null,
    isFromDrive: false,
    confirmationText: '',
    step: 'CONFIRM',
  });

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    backup: BackupItem | null;
    deleteTarget: 'LOCAL_ONLY' | 'DRIVE_ONLY' | 'BOTH';
  }>({
    open: false,
    backup: null,
    deleteTarget: 'BOTH',
  });

  // Drive Folder Preview Modal
  const [driveFolderPreviewOpen, setDriveFolderPreviewOpen] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleStartManualBackup = () => {
    setIsCreatingBackup(true);
    setCreationProgress(10);
    setRecentlyCreatedBackup(null);

    const interval = setInterval(() => {
      setCreationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          finishManualBackup();
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  const finishManualBackup = () => {
    setTimeout(() => {
      const now = new Date();
      const dateStr = '24 أغسطس 2026 - 15:30';
      const filename = `backup-2026-08-24-${now.getHours()}${now.getMinutes()}.zip`;

      const shouldUploadDrive = driveConnected && !driveExpired && uploadAlsoToDrive;

      const newBackup: BackupItem = {
        id: `b-${Date.now()}`,
        filename,
        createdAt: dateStr,
        sizeMb: 242,
        source: 'MANUAL',
        status: 'SUCCESS',
        driveStatus: shouldUploadDrive ? 'UPLOADED' : 'NOT_UPLOADED',
        localAvailable: true,
        metadata: {
          appVersion: 'v1.4.2',
          dbVersion: 'v2.1',
          organizationId: 'org-default',
          backupVersion: '2.0',
          tablesCount: 28,
        },
      };

      setBackups((prev) => [newBackup, ...prev]);
      setIsCreatingBackup(false);
      setRecentlyCreatedBackup(newBackup);

      if (shouldUploadDrive) {
        setDriveAccount((prev) => ({ ...prev, lastUploadAt: dateStr }));
        showNotification('تم إنشاء النسخة الاحتياطية ورفعها إلى Google Drive بنجاح.');
      } else {
        showNotification('تم إنشاء النسخة الاحتياطية بنجاح. يمكنك تحميل الملف الآن.');
      }
    }, 600);
  };

  const handleDownloadBackupFile = (backup: BackupItem) => {
    const element = document.createElement('a');
    const fileContent = JSON.stringify(
      {
        backupName: backup.filename,
        createdAt: backup.createdAt,
        metadata: backup.metadata,
        notice: 'ملف نسخة احتياطية مشفر لمنظومة إدارة الطلاب',
      },
      null,
      2
    );
    const file = new Blob([fileContent], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = backup.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification(`بدأ تحميل ملف النسخة الاحتياطية (${backup.filename}) على جهازك.`);
  };

  const handleUploadToDrive = (backup: BackupItem) => {
    if (!driveConnected || driveExpired) {
      showNotification('يرجى ربط حساب Google Drive أولاً لإتمام الرفع.', 'warning');
      return;
    }

    setBackups((prev) =>
      prev.map((b) => (b.id === backup.id ? { ...b, driveStatus: 'UPLOADING' } : b))
    );

    setTimeout(() => {
      setBackups((prev) =>
        prev.map((b) => (b.id === backup.id ? { ...b, driveStatus: 'UPLOADED' } : b))
      );
      setDriveAccount((prev) => ({ ...prev, lastUploadAt: 'الآن' }));
      showNotification(`تم رفع النسخة (${backup.filename}) إلى Google Drive بنجاح.`);
    }, 1200);
  };

  const handleStartGoogleOAuth = () => {
    setOauthStep('SELECT_ACCOUNT');
    setOauthModalOpen(true);
  };

  const handleCompleteOAuth = () => {
    setOauthStep('CONNECTING');
    setTimeout(() => {
      setDriveConnected(true);
      setDriveAccount({
        name: 'حساب جوجل المعتمد',
        email: oauthEmailInput || 'connected.admin@gmail.com',
        lastUploadAt: 'لم يتم الرفع بعد',
        folderName: 'Student Platform Backups/2026/August',
        quotaUsed: '1.8 GB',
        quotaTotal: '15 GB',
      });
      setOauthModalOpen(false);
      showNotification('تم ربط حساب Google Drive بنجاح وتجهيز مجلد التخزين السحابي.');
    }, 1200);
  };

  const handleDisconnectDrive = () => {
    setDriveConnected(false);
    setAutoUploadToDrive(false);
    showNotification('تم قطع الاتصال بـ Google Drive. النسخ المحلية آمنة ولم تتأثر.', 'warning');
  };

  const handleStartRestore = () => {
    if (restoreModal.confirmationText.trim() !== 'استعادة') return;

    setRestoreModal((prev) => ({ ...prev, step: 'VALIDATING' }));

    setTimeout(() => {
      setRestoreModal((prev) => ({ ...prev, step: 'RESTORING' }));

      setTimeout(() => {
        setRestoreModal((prev) => ({ ...prev, step: 'SUCCESS' }));
      }, 1500);
    }, 1000);
  };

  const handleFinishRestore = () => {
    setRestoreModal({
      open: false,
      backup: null,
      isFromDrive: false,
      confirmationText: '',
      step: 'CONFIRM',
    });
    showNotification('تمت استعادة النظام بنجاح من النسخة الاحتياطية المحددة.');
  };

  const handleExecuteDelete = () => {
    if (!deleteModal.backup) return;
    const { backup, deleteTarget } = deleteModal;

    if (deleteTarget === 'BOTH') {
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      showNotification(`تم حذف النسخة (${backup.filename}) من النظام ومن Google Drive.`);
    } else if (deleteTarget === 'LOCAL_ONLY') {
      setBackups((prev) =>
        prev.map((b) =>
          b.id === backup.id ? { ...b, localAvailable: false } : b
        )
      );
      showNotification(`تم حذف النسخة المحلية (${backup.filename}) مع الإبقاء عليها في Google Drive.`);
    } else if (deleteTarget === 'DRIVE_ONLY') {
      setBackups((prev) =>
        prev.map((b) =>
          b.id === backup.id ? { ...b, driveStatus: 'NOT_UPLOADED' } : b
        )
      );
      showNotification(`تم حذف النسخة (${backup.filename}) من Google Drive فقط.`);
    }

    setDeleteModal({ open: false, backup: null, deleteTarget: 'BOTH' });
  };

  return (
    <div className="backup-manager">
      {notification && (
        <div
          className={`alert alert-${notification.type} d-flex align-items-center gap-2 border-0 shadow-sm mb-3`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      <Card className="panel mb-3">
        <div className="panel__header">
          <div>
            <div className="d-flex align-items-center gap-2">
              <DatabaseBackup className="text-primary" size={22} />
              <h2 className="panel__title">النسخ الاحتياطي والتخزين السحابي (Backup & Cloud)</h2>
            </div>
            <p className="panel__subtitle">
              إدارة النسخ الاحتياطي اليدوي والآلي، والربط مع Google Drive لضمان حماية واستعادة البيانات
            </p>
          </div>
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              العودة للإعدادات
            </Button>
          )}
        </div>

        <div className="p-3 bg-light rounded-3 border mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="metric-card__icon bg-primary-subtle text-primary">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-grow-1">
              <span className="fw-bold text-dark">دعم الطريقتين معًا بتزامن كامل</span>
              <p className="text-secondary small mb-0 mt-1">
                يدعم النظام تحميل ملف النسخة الاحتياطية يدويًا على جهازك (Download)، وفي نفس الوقت رفع النسخة تلقائيًا إلى حساب Google Drive السحابي دون تعارض.
              </p>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-6">
            <div className="card h-100 border rounded-3 p-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <HardDriveDownload className="text-primary" size={20} />
                  <h5 className="fw-bold mb-0">1. النسخ اليدوي</h5>
                </div>
                <span className="badge bg-secondary-subtle text-secondary-emphasis small">تحميل مباشر</span>
              </div>
              <p className="text-secondary small mb-4">
                قم بإنشاء نسخة فورية شاملة لكافة الطلاب والدرجات وسجلات الحضور وتحميلها كملف مضغوط ZIP على جهازك.
              </p>

              {isCreatingBackup && (
                <div className="mb-4 p-3 bg-light rounded-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small fw-semibold text-primary d-flex align-items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> جاري تجميع قواعد البيانات وإنشاء النسخة...
                    </span>
                    <span className="small fw-bold">{creationProgress}%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div
                      className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                      style={{ width: `${creationProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {driveConnected && !driveExpired && (
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="uploadDriveCheckbox"
                    checked={uploadAlsoToDrive}
                    onChange={(e) => setUploadAlsoToDrive(e.target.checked)}
                  />
                  <label className="form-check-label small fw-semibold text-dark" htmlFor="uploadDriveCheckbox">
                    رفع النسخة أيضًا تلقائيًا إلى Google Drive المرتبط
                  </label>
                </div>
              )}

              <div className="d-flex flex-wrap gap-2 mt-auto">
                <Button
                  onClick={handleStartManualBackup}
                  loading={isCreatingBackup}
                  disabled={isCreatingBackup}
                  className="flex-grow-1"
                >
                  <Play size={16} /> إنشاء نسخة احتياطية الآن
                </Button>

                {recentlyCreatedBackup && (
                  <Button
                    variant="ghost"
                    className="border text-success"
                    onClick={() => handleDownloadBackupFile(recentlyCreatedBackup)}
                  >
                    <Download size={16} /> تحميل النسخة ({recentlyCreatedBackup.sizeMb} MB)
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100 border rounded-3 p-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Clock className="text-primary" size={20} />
                  <h5 className="fw-bold mb-0">2. النسخ التلقائي المجدول</h5>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoBackupSwitch"
                    checked={autoBackupEnabled}
                    onChange={(e) => {
                      setAutoBackupEnabled(e.target.checked);
                      showNotification(
                        e.target.checked
                          ? 'تم تفعيل النسخ الاحتياطي التلقائي.'
                          : 'تم إيقاف النسخ التلقائي.',
                        e.target.checked ? 'success' : 'warning'
                      );
                    }}
                  />
                </div>
              </div>
              <p className="text-secondary small mb-3">
                جدولة أخذ نسخ احتياطية تلقائية دورية وحفظها في السجل ورفعها سحابياً دون تدخل يدوي.
              </p>

              <div className={`row g-3 ${!autoBackupEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="col-md-6">
                  <label className="form-label small text-secondary">تكرار النسخ</label>
                  <select
                    className="form-select form-select-sm"
                    value={frequency}
                    disabled={!autoBackupEnabled}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="DAILY">يومي (Daily)</option>
                    <option value="WEEKLY">أسبوعي (Weekly)</option>
                    <option value="MONTHLY">شهري (Monthly)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-secondary">وقت أخذ النسخة</label>
                  <input
                    type="time"
                    className="form-control form-control-sm ltr-value"
                    value={backupTime}
                    disabled={!autoBackupEnabled}
                    onChange={(e) => setBackupTime(e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label small text-secondary">الاحتفاظ بالنسخ (Retention Policy)</label>
                  <div className="d-flex gap-2">
                    <select
                      className="form-select form-select-sm"
                      value={retentionPolicy}
                      disabled={!autoBackupEnabled}
                      onChange={(e) => setRetentionPolicy(e.target.value)}
                    >
                      <option value="7">آخر 7 نسخ (أسبوع كامل)</option>
                      <option value="30">آخر 30 نسخة (شهر كامل)</option>
                      <option value="90">آخر 90 نسخة (فصل دراسي)</option>
                      <option value="CUSTOM">عدد مخصص</option>
                    </select>
                    {retentionPolicy === 'CUSTOM' && (
                      <input
                        type="number"
                        className="form-control form-control-sm ltr-value"
                        style={{ width: '100px' }}
                        value={customRetentionDays}
                        disabled={!autoBackupEnabled}
                        onChange={(e) => setCustomRetentionDays(e.target.value)}
                        placeholder="أيام"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border rounded-3 p-4 bg-white mt-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              <Cloud className="text-primary" size={24} />
              <div>
                <h5 className="fw-bold mb-0">3. التخزين السحابي (Google Drive)</h5>
                <span className="text-secondary small">
                  حفظ النسخ الاحتياطية مشفرة وآمنة داخل مجلد مخصص في حساب Google Drive
                </span>
              </div>
            </div>

            <div>
              {driveConnected && !driveExpired ? (
                <span className="badge bg-success-subtle text-success-emphasis d-inline-flex align-items-center gap-1 px-3 py-2 fs-6">
                  <CheckCircle2 size={16} /> متصل بـ Google Drive
                </span>
              ) : driveExpired ? (
                <span className="badge bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center gap-1 px-3 py-2 fs-6">
                  <AlertTriangle size={16} /> يحتاج إعادة الاتصال
                </span>
              ) : (
                <span className="badge bg-secondary-subtle text-secondary-emphasis d-inline-flex align-items-center gap-1 px-3 py-2 fs-6">
                  <CloudOff size={16} /> غير متصل
                </span>
              )}
            </div>
          </div>

          {!driveConnected ? (
            <div className="p-4 bg-light rounded-3 text-center">
              <Cloud className="text-secondary mb-2" size={40} />
              <h6 className="fw-bold">لم يتم ربط حساب Google Drive بعد</h6>
              <p className="text-secondary small mb-3" style={{ maxWidth: '500px', margin: '0 auto' }}>
                قم بتسجيل الدخول باستخدام Google OAuth لحفظ النسخ الاحتياطية دورياً على سحابة Drive وحمايتها من التلف.
              </p>
              <Button onClick={handleStartGoogleOAuth}>
                <UploadCloud size={18} /> ربط حساب Google
              </Button>
            </div>
          ) : (
            <div>
              <div className="row g-3 p-3 bg-light rounded-3 mb-3">
                <div className="col-md-4">
                  <div className="text-secondary small">الحساب المتصل</div>
                  <div className="fw-bold text-dark mt-1">{driveAccount.name}</div>
                  <div className="text-muted small ltr-value">{driveAccount.email}</div>
                </div>
                <div className="col-md-4">
                  <div className="text-secondary small">مجلد النسخ السحابي</div>
                  <div className="fw-semibold text-primary mt-1 ltr-value font-monospace small">
                    {driveAccount.folderName}
                  </div>
                  <div className="text-secondary small mt-1">
                    آخر رفع: <span className="fw-semibold">{driveAccount.lastUploadAt}</span>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="text-secondary small">مساحة التخزين المستخدمة</div>
                  <div className="fw-bold mt-1">
                    {driveAccount.quotaUsed} <span className="text-muted small">من {driveAccount.quotaTotal}</span>
                  </div>
                  <div className="progress mt-1" style={{ height: '6px' }}>
                    <div className="progress-bar bg-primary" style={{ width: '28%' }} />
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-white mb-3">
                <div>
                  <span className="fw-bold text-dark">رفع النسخ تلقائيًا إلى Google Drive</span>
                  <p className="text-secondary small mb-0 mt-1">
                    عند تفعيل هذا الخيار، سيتم رفع كل نسخة تلقائية أو يدوية مباشرة إلى المجلد السحابي.
                  </p>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoUploadDriveSwitch"
                    checked={autoUploadToDrive}
                    onChange={(e) => {
                      setAutoUploadToDrive(e.target.checked);
                      showNotification(
                        e.target.checked
                          ? 'تم تفعيل الرفع التلقائي إلى Google Drive.'
                          : 'تم إيقاف الرفع التلقائي إلى Drive.',
                        'success'
                      );
                    }}
                  />
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                  onClick={() => setDriveFolderPreviewOpen(true)}
                >
                  <ExternalLink size={16} /> فتح مجلد Google Drive
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-light d-inline-flex align-items-center gap-1"
                  onClick={handleStartGoogleOAuth}
                >
                  <RefreshCw size={16} /> تغيير الحساب
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                  onClick={handleDisconnectDrive}
                >
                  <LogOut size={16} /> قطع الاتصال
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="fw-bold mb-0">4. سجل النسخ الاحتياطية (Backup History)</h5>
              <span className="text-secondary small">
                سجل كافة النسخ المنشأة محلياً وسحابياً مع إمكانية التنزيل والاستعادة الفورية
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 border">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '22%' }}>التاريخ والوقت</th>
                  <th style={{ width: '12%' }}>الحجم</th>
                  <th style={{ width: '12%' }}>المصدر</th>
                  <th style={{ width: '18%' }}>Google Drive</th>
                  <th style={{ width: '12%' }}>حالة الملف</th>
                  <th style={{ width: '24%' }} className="text-start">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div>
                        <span className="fw-bold text-dark ltr-value">{b.createdAt}</span>
                        <div className="text-secondary small font-monospace" style={{ fontSize: '0.75rem' }}>
                          {b.filename}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="fw-semibold ltr-value">{b.sizeMb} MB</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          b.source === 'AUTOMATIC'
                            ? 'bg-info-subtle text-info-emphasis'
                            : 'bg-primary-subtle text-primary-emphasis'
                        }`}
                      >
                        {b.source === 'AUTOMATIC' ? 'تلقائي' : 'يدوي'}
                      </span>
                    </td>
                    <td>
                      {b.driveStatus === 'UPLOADED' && (
                        <span className="badge bg-success-subtle text-success d-inline-flex align-items-center gap-1">
                          <CheckCircle2 size={12} /> تم الرفع ✅
                        </span>
                      )}
                      {b.driveStatus === 'NOT_UPLOADED' && (
                        <span className="badge bg-secondary-subtle text-secondary">لم يتم الرفع</span>
                      )}
                      {b.driveStatus === 'FAILED' && (
                        <span className="badge bg-danger-subtle text-danger d-inline-flex align-items-center gap-1">
                          <AlertTriangle size={12} /> فشل الرفع ⚠️
                        </span>
                      )}
                      {b.driveStatus === 'UPLOADING' && (
                        <span className="badge bg-primary-subtle text-primary d-inline-flex align-items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> جاري الرفع...
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge label="ناجح" tone="success" />
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        {b.localAvailable && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light p-1"
                            title="تحميل النسخة على جهازك"
                            onClick={() => handleDownloadBackupFile(b)}
                          >
                            <Download size={16} className="text-primary" />
                          </button>
                        )}

                        {b.driveStatus !== 'UPLOADED' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light p-1"
                            title={b.driveStatus === 'FAILED' ? 'إعادة محاولة الرفع لـ Drive' : 'رفع إلى Drive'}
                            onClick={() => handleUploadToDrive(b)}
                          >
                            <UploadCloud size={16} className="text-success" />
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary py-0 px-2 small"
                          title="استعادة هذه النسخة"
                          onClick={() =>
                            setRestoreModal({
                              open: true,
                              backup: b,
                              isFromDrive: !b.localAvailable && b.driveStatus === 'UPLOADED',
                              confirmationText: '',
                              step: 'CONFIRM',
                            })
                          }
                        >
                          <RotateCcw size={14} /> استعادة
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-light p-1 text-danger"
                          title="حذف"
                          onClick={() =>
                            setDeleteModal({
                              open: true,
                              backup: b,
                              deleteTarget: 'BOTH',
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {oauthModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <Cloud className="text-primary" size={22} />
                  <h5 className="modal-title fw-bold">ربط حساب Google Drive (OAuth 2.0)</h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() => setOauthModalOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                {oauthStep === 'SELECT_ACCOUNT' && (
                  <div>
                    <div className="text-center mb-4">
                      <div className="metric-card__icon bg-light text-primary mx-auto mb-2">
                        <UserCheck size={28} />
                      </div>
                      <h6 className="fw-bold">تسجيل الدخول باستخدام Google</h6>
                      <p className="text-secondary small">
                        سيتم طلب إذن الوصول لمجلد النسخ الاحتياطية فقط لحفظ واستعادة قواعد البيانات.
                      </p>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small text-secondary">البريد الإلكتروني لحساب Google:</label>
                      <input
                        type="email"
                        className="form-control ltr-value"
                        value={oauthEmailInput}
                        onChange={(e) => setOauthEmailInput(e.target.value)}
                        placeholder="name@gmail.com"
                      />
                    </div>

                    <div className="p-3 bg-light rounded-3 small text-secondary mb-3">
                      <div className="fw-bold text-dark mb-1">الصلاحيات المطلوبة (Scope):</div>
                      <div>• إنشاء وإدارة ملفات النسخ الاحتياطي الخاصة بالمنظومة فقط داخل Google Drive.</div>
                      <div>• لن يتمكن النظام من الوصول لأي ملفات شخصية أخرى على حسابك.</div>
                    </div>
                  </div>
                )}

                {oauthStep === 'CONNECTING' && (
                  <div className="text-center py-4">
                    <Loader2 size={36} className="animate-spin text-primary mx-auto mb-3" />
                    <h6 className="fw-bold">جاري التحقق من الصلاحيات والربط بـ Google Drive...</h6>
                    <p className="text-secondary small mb-0">يتم إنشاء المجلد السحابي وحفظ مفاتيح التوكن بأمان.</p>
                  </div>
                )}
              </div>

              <div className="modal-footer border-top px-4 py-3">
                <Button variant="ghost" onClick={() => setOauthModalOpen(false)}>
                  إلغاء
                </Button>
                {oauthStep === 'SELECT_ACCOUNT' && (
                  <Button onClick={handleCompleteOAuth}>
                    متابعة والموافقة على الصلاحيات
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {driveFolderPreviewOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <Cloud className="text-primary" size={22} />
                  <h5 className="modal-title fw-bold">مجلد Google Drive السحابي</h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() => setDriveFolderPreviewOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                <div className="d-flex align-items-center gap-2 p-2 bg-light rounded-3 text-secondary small ltr-value font-monospace mb-3">
                  <Cloud size={16} className="text-primary" />
                  <span>Google Drive &gt; Student Platform Backups &gt; 2026 &gt; August</span>
                </div>

                <div className="list-group">
                  {backups
                    .filter((b) => b.driveStatus === 'UPLOADED')
                    .map((b) => (
                      <div
                        key={b.id}
                        className="list-group-item list-group-item-action d-flex align-items-center justify-content-between p-3"
                      >
                        <div className="d-flex align-items-center gap-3">
                          <FileArchive size={24} className="text-primary" />
                          <div>
                            <span className="fw-bold text-dark ltr-value">{b.filename}</span>
                            <div className="text-secondary small">{b.createdAt} • {b.sizeMb} MB</div>
                          </div>
                        </div>
                        <span className="badge bg-success-subtle text-success">محفوظ على السحابة</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="modal-footer border-top px-4 py-3">
                <Button variant="ghost" onClick={() => setDriveFolderPreviewOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoreModal.open && restoreModal.backup && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom px-4 py-3 bg-danger-subtle text-danger-emphasis">
                <div className="d-flex align-items-center gap-2">
                  <ShieldAlert className="text-danger" size={24} />
                  <h5 className="modal-title fw-bold">استعادة نسخة احتياطية</h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() =>
                    setRestoreModal({
                      open: false,
                      backup: null,
                      isFromDrive: false,
                      confirmationText: '',
                      step: 'CONFIRM',
                    })
                  }
                />
              </div>

              <div className="modal-body p-4">
                {restoreModal.step === 'CONFIRM' && (
                  <div>
                    <div className="alert alert-danger border-0 p-3 mb-3 small">
                      <div className="fw-bold mb-1">تحذير أمني خطير:</div>
                      <div>
                        سيتم استبدال كافة البيانات الحالية في النظام بالبيانات الموجودة في النسخة الاحتياطية المحددة أدناه. أي بيانات تم إدخالها بعد هذا التاريخ ستفقد.
                      </div>
                    </div>

                    <div className="p-3 bg-light rounded-3 mb-4">
                      <div className="row g-2 small">
                        <div className="col-6">
                          <span className="text-secondary">تاريخ النسخة:</span>
                          <div className="fw-bold ltr-value">{restoreModal.backup.createdAt}</div>
                        </div>
                        <div className="col-6">
                          <span className="text-secondary">حجم الملف:</span>
                          <div className="fw-bold ltr-value">{restoreModal.backup.sizeMb} MB</div>
                        </div>
                        <div className="col-6">
                          <span className="text-secondary">مصدر النسخة:</span>
                          <div className="fw-bold">
                            {restoreModal.backup.source === 'AUTOMATIC' ? 'نسخ تلقائي مجدول' : 'نسخ يدوي'}
                          </div>
                        </div>
                        <div className="col-6">
                          <span className="text-secondary">مكان التخزين:</span>
                          <div className="fw-bold text-primary">
                            {restoreModal.isFromDrive ? 'سحابة Google Drive' : 'التخزين المحلي'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold small text-danger">
                        لتأكيد العملية، يرجى كتابة كلمة &quot;استعادة&quot; في المربع أدناه:
                      </label>
                      <input
                        type="text"
                        className="form-control text-center fw-bold"
                        placeholder="استعادة"
                        value={restoreModal.confirmationText}
                        onChange={(e) =>
                          setRestoreModal((prev) => ({
                            ...prev,
                            confirmationText: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {restoreModal.step === 'VALIDATING' && (
                  <div className="text-center py-4">
                    <Loader2 size={36} className="animate-spin text-primary mx-auto mb-3" />
                    <h6 className="fw-bold">جاري فحص وتدقيق سلامة ملف النسخة الاحتياطية...</h6>
                    <p className="text-secondary small mb-0">التحقق من صحة الجداول، المفاتيح والتشفير.</p>
                  </div>
                )}

                {restoreModal.step === 'RESTORING' && (
                  <div className="text-center py-4">
                    <Loader2 size={36} className="animate-spin text-danger mx-auto mb-3" />
                    <h6 className="fw-bold text-danger">جاري استبدال البيانات واستعادة المنظومة...</h6>
                    <p className="text-secondary small mb-0">يرجى الانتظار وعدم إغلاق المتصفح حتى انتهاء الاستعادة.</p>
                  </div>
                )}

                {restoreModal.step === 'SUCCESS' && (
                  <div className="text-center py-4">
                    <CheckCircle2 size={42} className="text-success mx-auto mb-3" />
                    <h6 className="fw-bold text-success">تمت الاستعادة بنجاح!</h6>
                    <p className="text-secondary small mb-0">
                      تم استرجاع كافة السجلات بنجاح وتحديث حالة المنظومة.
                    </p>
                  </div>
                )}
              </div>

              <div className="modal-footer border-top px-4 py-3">
                {restoreModal.step === 'CONFIRM' && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setRestoreModal({
                          open: false,
                          backup: null,
                          isFromDrive: false,
                          confirmationText: '',
                          step: 'CONFIRM',
                        })
                      }
                    >
                      إلغاء
                    </Button>
                    <Button
                      variant="primary"
                      className="btn-danger"
                      disabled={restoreModal.confirmationText.trim() !== 'استعادة'}
                      onClick={handleStartRestore}
                    >
                      بدء الاستعادة
                    </Button>
                  </>
                )}
                {restoreModal.step === 'SUCCESS' && (
                  <Button onClick={handleFinishRestore}>
                    إتمام والمتابعة
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModal.open && deleteModal.backup && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <Trash2 className="text-danger" size={20} />
                  <h5 className="modal-title fw-bold">أين تريد حذف النسخة الاحتياطية؟</h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() => setDeleteModal({ open: false, backup: null, deleteTarget: 'BOTH' })}
                />
              </div>

              <div className="modal-body p-4">
                <p className="text-secondary small mb-3">
                  النسخة ({deleteModal.backup.filename}) متوفرة محلياً وعلى Google Drive. حدد نطاق الحذف:
                </p>

                <div className="d-grid gap-2">
                  <label className="p-3 border rounded-3 d-flex align-items-center gap-3 cursor-pointer bg-light">
                    <input
                      type="radio"
                      name="deleteTargetRadio"
                      checked={deleteModal.deleteTarget === 'BOTH'}
                      onChange={() =>
                        setDeleteModal((prev) => ({ ...prev, deleteTarget: 'BOTH' }))
                      }
                    />
                    <div>
                      <div className="fw-bold text-danger">حذف النسختين معًا (محليًا وسحابيًا)</div>
                      <div className="text-secondary small">حذف الملف نهائياً من النظام ومن حساب Google Drive</div>
                    </div>
                  </label>

                  <label className="p-3 border rounded-3 d-flex align-items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteTargetRadio"
                      checked={deleteModal.deleteTarget === 'LOCAL_ONLY'}
                      onChange={() =>
                        setDeleteModal((prev) => ({ ...prev, deleteTarget: 'LOCAL_ONLY' }))
                      }
                    />
                    <div>
                      <div className="fw-bold text-dark">حذف النسخة من النظام فقط</div>
                      <div className="text-secondary small">الإبقاء على النسخة السحابية في Google Drive</div>
                    </div>
                  </label>

                  <label className="p-3 border rounded-3 d-flex align-items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteTargetRadio"
                      checked={deleteModal.deleteTarget === 'DRIVE_ONLY'}
                      onChange={() =>
                        setDeleteModal((prev) => ({ ...prev, deleteTarget: 'DRIVE_ONLY' }))
                      }
                    />
                    <div>
                      <div className="fw-bold text-dark">حذف النسخة من Google Drive فقط</div>
                      <div className="text-secondary small">الإبقاء على النسخة المحلية على السيرفر</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-footer border-top px-4 py-3">
                <Button
                  variant="ghost"
                  onClick={() => setDeleteModal({ open: false, backup: null, deleteTarget: 'BOTH' })}
                >
                  إلغاء
                </Button>
                <Button className="btn-danger" onClick={handleExecuteDelete}>
                  تأكيد الحذف
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
