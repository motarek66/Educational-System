import * as XLSX from 'xlsx';
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
import * as XLSXLib from 'xlsx';

// ─── Accepted column names (flexible matching) ───────────────────────────────
const COL_FULL_NAME   = ['اسم الطالب', 'fullname', 'full_name', 'name'];
const COL_GRADE       = ['المرحلة الدراسية', 'grade', 'gradelevel', 'grade_level', 'المرحلة'];
const COL_GUARDIAN    = ['اسم ولي الأمر', 'guardian', 'guardianname', 'guardian_name'];
const COL_GUARDIAN_PH = ['رقم ولي الأمر', 'guardianphone', 'guardian_phone', 'parent_phone', 'parentphone'];
const COL_STUDENT_PH  = ['رقم الطالب', 'studentphone', 'student_phone', 'phone'];
const COL_STATUS      = ['الحالة', 'status'];

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
];

const STATUS_MAP: Record<string, string> = {
  'نشط': 'ACTIVE',
  'active': 'ACTIVE',
  'غير نشط': 'INACTIVE',
  'inactive': 'INACTIVE',
  'منسحب': 'WITHDRAWN',
  'withdrawn': 'WITHDRAWN',
  'موقوف': 'SUSPENDED',
  'suspended': 'SUSPENDED',
};

type ParsedRow = {
  rowIndex: number;
  fullName: string;
  gradeLevel: string;
  guardianName: string;
  guardianPhone: string;
  studentPhone: string;
  status: string;
  errors: string[];
};

type ImportResult = {
  success: number;
  failed: number;
  errors: Array<{ row: number; name: string; message: string }>;
};

function findCol(headers: string[], candidates: string[]): string | undefined {
  return headers.find((h) =>
    candidates.some((c) => h.trim().toLowerCase() === c.toLowerCase())
  );
}

function parseSheet(worksheet: XLSX.WorkSheet): ParsedRow[] {
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (jsonRows.length === 0) return [];

  const headers = Object.keys(jsonRows[0] ?? {});
  const colFullName   = findCol(headers, COL_FULL_NAME);
  const colGrade      = findCol(headers, COL_GRADE);
  const colGuardian   = findCol(headers, COL_GUARDIAN);
  const colGuardianPh = findCol(headers, COL_GUARDIAN_PH);
  const colStudentPh  = findCol(headers, COL_STUDENT_PH);
  const colStatus     = findCol(headers, COL_STATUS);

  return jsonRows.map((row, i) => {
    const errors: string[] = [];
    const fullName   = String(colFullName ? row[colFullName] ?? '' : '').trim();
    const gradeLevel = String(colGrade    ? row[colGrade]    ?? '' : '').trim();
    const guardName  = String(colGuardian ? row[colGuardian] ?? '' : '').trim();
    const guardPhone = String(colGuardianPh ? row[colGuardianPh] ?? '' : '').trim();
    const studPhone  = String(colStudentPh  ? row[colStudentPh]  ?? '' : '').trim();
    const rawStatus  = String(colStatus ? row[colStatus] ?? 'نشط' : 'نشط').trim();
    const status     = STATUS_MAP[rawStatus] ?? STATUS_MAP[rawStatus.toLowerCase()] ?? 'ACTIVE';

    if (!fullName || fullName.length < 3) errors.push('اسم الطالب مطلوب (3 أحرف على الأقل)');
    if (!gradeLevel || !GRADE_LEVELS.includes(gradeLevel)) {
      errors.push(`المرحلة الدراسية غير صالحة: "${gradeLevel}"`);
    }
    if (!guardName || guardName.length < 3) errors.push('اسم ولي الأمر مطلوب (3 أحرف على الأقل)');
    if (!guardPhone || guardPhone.length < 8) errors.push('رقم ولي الأمر مطلوب (8 خانات على الأقل)');

    return {
      rowIndex: i + 2, // Excel rows start at 2 (1 = header)
      fullName,
      gradeLevel,
      guardianName: guardName,
      guardianPhone: guardPhone,
      studentPhone: studPhone,
      status,
      errors,
    };
  });
}

/** Generate a blank import template Excel file */
function downloadTemplate() {
  const rows = [
    {
      'اسم الطالب': 'محمد أحمد السيد',
      'المرحلة الدراسية': 'الثالث الثانوي',
      'اسم ولي الأمر': 'أحمد السيد',
      'رقم ولي الأمر': '+201012345678',
      'رقم الطالب': '+201198765432',
      'الحالة': 'نشط',
    },
    {
      'اسم الطالب': 'فاطمة محمود',
      'المرحلة الدراسية': 'الأول الثانوي',
      'اسم ولي الأمر': 'محمود إبراهيم',
      'رقم ولي الأمر': '+201156789012',
      'رقم الطالب': '',
      'الحالة': 'نشط',
    },
  ];
  const ws = XLSXLib.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
  const wb = XLSXLib.utils.book_new();
  XLSXLib.utils.book_append_sheet(wb, ws, 'الطلاب');
  XLSXLib.writeFile(wb, 'students-import-template.xlsx');
}

type Step = 'IDLE' | 'PREVIEW' | 'IMPORTING' | 'DONE';

export function StudentImportDialog({
  open,
  onClose,
  centerId,
  centerName,
}: {
  open: boolean;
  onClose: () => void;
  centerId: string;
  centerName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('IDLE');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const validRows   = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); }
    if (!open && dialog.open) { dialog.close(); }
  }, [open]);

  const resetState = () => {
    setStep('IDLE');
    setFileName('');
    setRows([]);
    setImportResult(null);
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGlobalError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('الملف فارغ أو غير صالح.');
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) throw new Error('لا توجد بيانات في الورقة الأولى.');
        const parsed = parseSheet(worksheet);
        if (parsed.length === 0) {
          setGlobalError('لم يتم العثور على أي صفوف بيانات في الملف.');
          return;
        }
        setFileName(file.name);
        setRows(parsed);
        setStep('PREVIEW');
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'فشل قراءة ملف Excel. تأكد من صحة الصيغة.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleStartImport = async () => {
    if (validRows.length === 0) return;
    setStep('IMPORTING');
    setGlobalError(null);

    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    // Import one by one to collect per-row errors
    for (const row of validRows) {
      try {
        await api.post<ApiResponse<{ id: string }>>('/students', {
          fullName: row.fullName,
          gradeLevel: row.gradeLevel,
          centerId,
          guardianName: row.guardianName,
          guardianPhone: row.guardianPhone,
          studentPhone: row.studentPhone || undefined,
          status: row.status,
        });
        result.success++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          row: row.rowIndex,
          name: row.fullName,
          message: getApiErrorMessage(err),
        });
      }
    }

    setImportResult(result);
    setStep('DONE');

    if (result.success > 0) {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  };

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
              {centerName
                ? `الاستيراد إلى السنتر: ${centerName}`
                : 'قم بتحميل ملف Excel لإضافة طلاب جدد بالجملة.'}
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

        {/* ─── STEP: IDLE ──────────────────────────────────────── */}
        {step === 'IDLE' && (
          <div>
            {/* Upload zone */}
            <div
              className="border-2 border-dashed rounded-4 p-5 text-center bg-light mb-4"
              style={{ borderColor: 'var(--color-primary-300)', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  // Simulate change event
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }}
            >
              <FileSpreadsheet size={48} className="text-success mb-3" />
              <h5 className="fw-bold mb-1">اسحب ملف Excel هنا أو انقر للاختيار</h5>
              <p className="text-secondary small mb-0">
                يدعم الصيغ: <span className="ltr-value fw-medium">.xlsx، .xls، .csv</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="d-none"
                onChange={handleFileChange}
              />
            </div>

            {/* Requirements */}
            <div className="p-3 bg-light rounded-3 mb-4 small">
              <div className="fw-bold text-dark mb-2">📋 الأعمدة المطلوبة في الملف:</div>
              <div className="row g-1">
                {[
                  { label: 'اسم الطالب', required: true },
                  { label: 'المرحلة الدراسية', required: true },
                  { label: 'اسم ولي الأمر', required: true },
                  { label: 'رقم ولي الأمر', required: true },
                  { label: 'رقم الطالب', required: false },
                  { label: 'الحالة', required: false, note: 'افتراضي: نشط' },
                ].map((col) => (
                  <div key={col.label} className="col-md-6">
                    <span className={`badge me-1 ${col.required ? 'bg-danger-subtle text-danger-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`}>
                      {col.required ? 'مطلوب' : 'اختياري'}
                    </span>
                    <span className="text-dark fw-semibold">{col.label}</span>
                    {col.note && <span className="text-muted ms-1">({col.note})</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-light d-inline-flex align-items-center gap-2"
                onClick={downloadTemplate}
              >
                <Download size={16} className="text-success" />
                تحميل ملف نموذج فارغ
              </button>
              <Button type="button" variant="ghost" onClick={handleClose}>إلغاء</Button>
            </div>
          </div>
        )}

        {/* ─── STEP: PREVIEW ───────────────────────────────────── */}
        {step === 'PREVIEW' && (
          <div>
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-4">
              <FileSpreadsheet size={28} className="text-success flex-shrink-0" />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-bold text-dark text-truncate">{fileName}</div>
                <div className="text-secondary small">
                  إجمالي الصفوف: <span className="fw-bold text-dark">{rows.length}</span>
                  {invalidRows.length > 0 && (
                    <span className="text-danger fw-semibold ms-2">
                      · {invalidRows.length} صفوف بها أخطاء
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={resetState}
              >
                تغيير الملف
              </button>
            </div>

            {/* Stats row */}
            <div className="row g-3 mb-4">
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-success-subtle">
                  <div className="fs-3 fw-bold text-success">{validRows.length}</div>
                  <div className="small text-success fw-semibold">جاهز للاستيراد</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-danger-subtle">
                  <div className="fs-3 fw-bold text-danger">{invalidRows.length}</div>
                  <div className="small text-danger fw-semibold">بها أخطاء</div>
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 rounded-3 text-center bg-light">
                  <div className="fs-3 fw-bold text-dark">{rows.length}</div>
                  <div className="small text-secondary fw-semibold">إجمالي الصفوف</div>
                </div>
              </div>
            </div>

            {/* Errors list */}
            {invalidRows.length > 0 && (
              <div className="mb-4">
                <div className="fw-bold text-danger mb-2 d-flex align-items-center gap-2">
                  <AlertTriangle size={16} />
                  الصفوف التي بها أخطاء (لن يتم استيرادها):
                </div>
                <div className="border rounded-3 overflow-hidden" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>رقم الصف</th>
                        <th>الاسم</th>
                        <th>الخطأ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invalidRows.map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="ltr-value fw-semibold">{r.rowIndex}</td>
                          <td>{r.fullName || '—'}</td>
                          <td className="text-danger small">{r.errors.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Valid preview */}
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
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 50).map((r) => (
                        <tr key={r.rowIndex}>
                          <td className="text-secondary ltr-value">{r.rowIndex}</td>
                          <td className="fw-semibold">{r.fullName}</td>
                          <td className="small">{r.gradeLevel}</td>
                          <td className="small">{r.guardianName}</td>
                          <td className="small ltr-value">{r.guardianPhone}</td>
                          <td>
                            <span className="badge bg-success-subtle text-success-emphasis small">
                              {r.status === 'ACTIVE' ? 'نشط' : r.status}
                            </span>
                          </td>
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

            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>إلغاء</Button>
              <Button
                type="button"
                disabled={validRows.length === 0}
                onClick={() => void handleStartImport()}
              >
                <Upload size={16} />
                استيراد {validRows.length} طالب
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP: IMPORTING ─────────────────────────────────── */}
        {step === 'IMPORTING' && (
          <div className="text-center py-5">
            <Loader2 size={48} className="text-primary mb-3 animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <h5 className="fw-bold mb-2">جاري استيراد بيانات الطلاب...</h5>
            <p className="text-secondary small mb-0">
              يتم إنشاء الحسابات وتوليد الأكواد وكودات QR تلقائياً. يرجى الانتظار.
            </p>
          </div>
        )}

        {/* ─── STEP: DONE ──────────────────────────────────────── */}
        {step === 'DONE' && importResult && (
          <div>
            <div className="text-center mb-4">
              {importResult.failed === 0 ? (
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
                  <div className="fs-2 fw-bold text-success">{importResult.success}</div>
                  <div className="small text-success fw-semibold">تم استيرادهم بنجاح ✅</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-3 text-center bg-danger-subtle">
                  <div className="fs-2 fw-bold text-danger">{importResult.failed}</div>
                  <div className="small text-danger fw-semibold">فشل استيرادهم ❌</div>
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-4">
                <div className="fw-bold text-danger mb-2">أخطاء أثناء الاستيراد:</div>
                <div className="border rounded-3 overflow-hidden" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table className="table table-sm mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>الصف</th>
                        <th>الاسم</th>
                        <th>السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="ltr-value">{err.row}</td>
                          <td>{err.name}</td>
                          <td className="text-danger small">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              {importResult.failed > 0 && (
                <Button type="button" variant="ghost" onClick={resetState}>
                  استيراد ملف آخر
                </Button>
              )}
              <Button type="button" onClick={handleClose}>
                إغلاق
              </Button>
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
