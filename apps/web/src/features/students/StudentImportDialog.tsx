import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';

// ─── Types from /imports/students/upload response ─────────────────────────────
type PreviewRow = {
  rowNumber: number;
  fullName: string;
  gradeLevel: string;
  guardianName: string;
  guardianPhone: string;
  centerCode: string;
  errors: string[];
};

type UploadResponse = {
  id: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: PreviewRow[];
};

type CommitResponse = {
  imported: number;
  failed: number;
  failures: Array<{ rowNumber: number; message: string }>;
};

type Step = 'IDLE' | 'UPLOADING' | 'PREVIEW' | 'COMMITTING' | 'DONE';

/** Download the official import template from the API */
async function downloadTemplate() {
  const response = await api.get('/imports/templates/students', {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data as BlobPart]));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'students-import-template.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function StudentImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('IDLE');
  const [fileName, setFileName] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const resetState = () => {
    setStep('IDLE');
    setFileName('');
    setUploadResult(null);
    setCommitResult(null);
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGlobalError(null);
    setStep('UPLOADING');
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<ApiResponse<UploadResponse>>('/imports/students/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadResult(response.data.data);
      setStep('PREVIEW');
    } catch (err) {
      setGlobalError(getApiErrorMessage(err));
      setStep('IDLE');
    }
  };

  const handleCommit = async () => {
    if (!uploadResult) return;
    setStep('COMMITTING');
    setGlobalError(null);

    try {
      const response = await api.post<ApiResponse<CommitResponse>>(`/imports/${uploadResult.id}/commit`);
      setCommitResult(response.data.data);
      setStep('DONE');

      if (response.data.data.imported > 0) {
        await queryClient.invalidateQueries({ queryKey: ['students'] });
      }
    } catch (err) {
      setGlobalError(getApiErrorMessage(err));
      setStep('PREVIEW');
    }
  };

  const validRows   = uploadResult?.preview.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = uploadResult?.preview.filter((r) => r.errors.length > 0)  ?? [];

  return (
    <dialog
      ref={dialogRef}
      className="student-form-dialog border-0 rounded-4 p-0"
      style={{ maxWidth: 'min(95vw, 760px)', width: '100%' }}
      onCancel={handleClose}
      onClose={onClose}
    >
      <div className="app-card p-4">
        {/* Header */}
        <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div>
            <h2 className="h4 mb-1">استيراد طلاب من Excel</h2>
            <p className="text-secondary small mb-0">
              ارفع ملف Excel لإضافة طلاب جدد بالجملة — يتم مراجعة البيانات قبل الحفظ.
            </p>
          </div>
          <button className="btn p-1" type="button" onClick={handleClose} aria-label="إغلاق">
            <X />
          </button>
        </div>

        {globalError && (
          <div className="alert alert-danger border-0 d-flex align-items-center gap-2 mb-3">
            <AlertTriangle size={18} />
            <span>{globalError}</span>
          </div>
        )}

        {/* ─── IDLE ──────────────────────────────────────────── */}
        {step === 'IDLE' && (
          <div>
            <div
              className="border rounded-4 p-5 text-center mb-4"
              style={{
                borderStyle: 'dashed',
                borderColor: 'var(--color-primary-300)',
                background: 'var(--surface-subtle)',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  void handleFileChange({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
                }
              }}
            >
              <FileSpreadsheet size={48} className="text-success mb-3" />
              <h5 className="fw-bold mb-1">اسحب ملف Excel هنا أو انقر للاختيار</h5>
              <p className="text-secondary small mb-0 ltr-value">.xlsx فقط — حجم أقصى 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="d-none"
                onChange={(e) => void handleFileChange(e)}
              />
            </div>

            {/* Required columns */}
            <div className="p-3 bg-light rounded-3 mb-4 small">
              <div className="fw-bold text-dark mb-2">📋 الأعمدة المطلوبة في الملف:</div>
              <div className="row g-1">
                {[
                  { col: 'full_name',      label: 'اسم الطالب',       required: true },
                  { col: 'grade_level',    label: 'المرحلة الدراسية', required: true },
                  { col: 'guardian_name',  label: 'اسم ولي الأمر',    required: true },
                  { col: 'guardian_phone', label: 'رقم ولي الأمر',    required: true },
                  { col: 'center_code',    label: 'كود السنتر',        required: true },
                  { col: 'student_phone',  label: 'رقم الطالب',       required: false },
                  { col: 'school_name',    label: 'اسم المدرسة',      required: false },
                  { col: 'notes',          label: 'ملاحظات',          required: false },
                ].map((item) => (
                  <div key={item.col} className="col-md-6 d-flex align-items-center gap-2">
                    <span className={`badge ${item.required ? 'bg-danger-subtle text-danger-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`}>
                      {item.required ? 'إلزامي' : 'اختياري'}
                    </span>
                    <span className="text-dark fw-semibold">{item.label}</span>
                    <span className="text-muted ltr-value">({item.col})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-light d-inline-flex align-items-center gap-2"
                onClick={() => void downloadTemplate()}
              >
                <Download size={16} className="text-success" />
                تحميل نموذج Excel فارغ
              </button>
              <Button type="button" variant="ghost" onClick={handleClose}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* ─── UPLOADING ──────────────────────────────────────── */}
        {step === 'UPLOADING' && (
          <div className="text-center py-5">
            <Loader2 size={48} className="text-primary mb-3" style={{ animation: 'spin 1s linear infinite' }} />
            <h5 className="fw-bold mb-2">جاري رفع الملف وتحليل البيانات...</h5>
            <p className="text-secondary small mb-0">{fileName}</p>
          </div>
        )}

        {/* ─── PREVIEW ────────────────────────────────────────── */}
        {step === 'PREVIEW' && uploadResult && (
          <div>
            {/* File info */}
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-4">
              <FileSpreadsheet size={28} className="text-success flex-shrink-0" />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-bold text-dark text-truncate">{fileName}</div>
                <div className="text-secondary small mt-1">
                  إجمالي: <strong>{uploadResult.totalRows}</strong> صف
                  {uploadResult.invalidRows > 0 && (
                    <span className="text-danger fw-semibold ms-2">
                      · {uploadResult.invalidRows} بها أخطاء
                    </span>
                  )}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-light" onClick={resetState}>
                تغيير الملف
              </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-success-subtle">
                  <div className="fs-3 fw-bold text-success">{uploadResult.validRows}</div>
                  <div className="small text-success fw-semibold">جاهز للاستيراد</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-danger-subtle">
                  <div className="fs-3 fw-bold text-danger">{uploadResult.invalidRows}</div>
                  <div className="small text-danger fw-semibold">بها أخطاء</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-light">
                  <div className="fs-3 fw-bold text-dark">{uploadResult.totalRows}</div>
                  <div className="small text-secondary fw-semibold">إجمالي الصفوف</div>
                </div>
              </div>
            </div>

            {/* Error rows */}
            {invalidRows.length > 0 && (
              <div className="mb-4">
                <div className="fw-bold text-danger mb-2 d-flex align-items-center gap-2">
                  <AlertTriangle size={16} />
                  الصفوف التي بها أخطاء (لن يتم استيرادها):
                </div>
                <div className="border rounded-3 overflow-hidden" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>رقم الصف</th>
                        <th>الاسم</th>
                        <th>كود السنتر</th>
                        <th>الخطأ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invalidRows.map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="ltr-value fw-semibold">{r.rowNumber}</td>
                          <td>{r.fullName || '—'}</td>
                          <td className="ltr-value">{r.centerCode || '—'}</td>
                          <td className="text-danger small">{r.errors.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid rows preview */}
            {validRows.length > 0 && (
              <div className="mb-4">
                <div className="fw-bold text-success mb-2 d-flex align-items-center gap-2">
                  <CheckCircle2 size={16} />
                  معاينة الصفوف الصحيحة:
                </div>
                <div className="border rounded-3 overflow-hidden" style={{ maxHeight: 240, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>اسم الطالب</th>
                        <th>المرحلة</th>
                        <th>ولي الأمر</th>
                        <th>الهاتف</th>
                        <th>السنتر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 50).map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="text-secondary ltr-value">{r.rowNumber}</td>
                          <td className="fw-semibold">{r.fullName}</td>
                          <td className="small">{r.gradeLevel}</td>
                          <td className="small">{r.guardianName}</td>
                          <td className="small ltr-value">{r.guardianPhone}</td>
                          <td className="small ltr-value fw-semibold text-primary">{r.centerCode}</td>
                        </tr>
                      ))}
                      {validRows.length > 50 && (
                        <tr>
                          <td colSpan={6} className="text-center text-secondary small py-2">
                            ... و {validRows.length - 50} صفوف أخرى
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>إلغاء</Button>
              <Button
                type="button"
                disabled={uploadResult.validRows === 0}
                onClick={() => void handleCommit()}
              >
                <Upload size={16} />
                استيراد {uploadResult.validRows} طالب
              </Button>
            </div>
          </div>
        )}

        {/* ─── COMMITTING ────────────────────────────────────── */}
        {step === 'COMMITTING' && (
          <div className="text-center py-5">
            <Loader2 size={48} className="text-primary mb-3" style={{ animation: 'spin 1s linear infinite' }} />
            <h5 className="fw-bold mb-2">جاري استيراد بيانات الطلاب...</h5>
            <p className="text-secondary small mb-0">
              يتم إنشاء الحسابات، الأكواد، وكودات QR تلقائياً. يرجى الانتظار.
            </p>
          </div>
        )}

        {/* ─── DONE ──────────────────────────────────────────── */}
        {step === 'DONE' && commitResult && (
          <div>
            <div className="text-center mb-4">
              {commitResult.failed === 0 ? (
                <>
                  <CheckCircle2 size={56} className="text-success mb-3" />
                  <h5 className="fw-bold text-success">تم الاستيراد بنجاح!</h5>
                </>
              ) : (
                <>
                  <AlertTriangle size={56} className="text-warning mb-3" />
                  <h5 className="fw-bold text-warning">تم الاستيراد مع بعض الأخطاء</h5>
                </>
              )}
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <div className="p-3 rounded-3 text-center bg-success-subtle">
                  <div className="fs-2 fw-bold text-success">{commitResult.imported}</div>
                  <div className="small text-success fw-semibold">تم استيرادهم بنجاح ✅</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-3 text-center bg-danger-subtle">
                  <div className="fs-2 fw-bold text-danger">{commitResult.failed}</div>
                  <div className="small text-danger fw-semibold">فشل استيرادهم ❌</div>
                </div>
              </div>
            </div>

            {commitResult.failures.length > 0 && (
              <div className="mb-4">
                <div className="fw-bold text-danger mb-2">أخطاء أثناء الاستيراد:</div>
                <div className="border rounded-3 overflow-hidden" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0">
                    <thead className="table-light">
                      <tr><th>الصف</th><th>السبب</th></tr>
                    </thead>
                    <tbody>
                      {commitResult.failures.map((f, i) => (
                        <tr key={i}>
                          <td className="ltr-value">{f.rowNumber}</td>
                          <td className="text-danger small">{f.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              {commitResult.failed > 0 && (
                <Button type="button" variant="ghost" onClick={resetState}>
                  استيراد ملف آخر
                </Button>
              )}
              <Button type="button" onClick={handleClose}>إغلاق</Button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </dialog>
  );
}
