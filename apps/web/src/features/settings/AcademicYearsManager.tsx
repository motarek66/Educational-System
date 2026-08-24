import { useState } from 'react';
import {
  Archive,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Edit3,
  Eye,
  Layers,
  Palmtree,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';

export type Semester = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type Holiday = {
  id: string;
  name: string;
  type: 'OFFICIAL' | 'DAY_OFF' | 'VACATION_PERIOD';
  startDate: string;
  endDate: string;
};

export type AcademicYearItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'CURRENT' | 'UPCOMING' | 'ENDED' | 'ARCHIVED';
  semesters: Semester[];
  holidays: Holiday[];
  studentsCount?: number;
};

const initialAcademicYears: AcademicYearItem[] = [
  {
    id: 'ay-2026-2027',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
    status: 'CURRENT',
    semesters: [
      { id: 'sem-1', name: 'الفصل الدراسي الأول', startDate: '2026-09-01', endDate: '2027-01-20' },
      { id: 'sem-2', name: 'الفصل الدراسي الثاني', startDate: '2027-02-05', endDate: '2027-06-30' },
    ],
    holidays: [
      { id: 'hol-1', name: 'إجازة نصر أكتوبر', type: 'OFFICIAL', startDate: '2026-10-06', endDate: '2026-10-06' },
      { id: 'hol-2', name: 'إجازة نصف العام', type: 'VACATION_PERIOD', startDate: '2027-01-21', endDate: '2027-02-04' },
      { id: 'hol-3', name: 'إجازة عيد الفطر المبارك', type: 'VACATION_PERIOD', startDate: '2027-03-28', endDate: '2027-04-02' },
    ],
    studentsCount: 384,
  },
  {
    id: 'ay-2025-2026',
    name: '2025/2026',
    startDate: '2025-09-01',
    endDate: '2026-06-30',
    status: 'ENDED',
    semesters: [
      { id: 'sem-2025-1', name: 'الفصل الدراسي الأول', startDate: '2025-09-01', endDate: '2026-01-18' },
      { id: 'sem-2025-2', name: 'الفصل الدراسي الثاني', startDate: '2026-02-01', endDate: '2026-06-30' },
    ],
    holidays: [
      { id: 'hol-2025-1', name: 'إجازة نصف العام', type: 'VACATION_PERIOD', startDate: '2026-01-19', endDate: '2026-01-31' },
    ],
    studentsCount: 320,
  },
  {
    id: 'ay-2027-2028',
    name: '2027/2028',
    startDate: '2027-09-01',
    endDate: '2028-06-30',
    status: 'UPCOMING',
    semesters: [
      { id: 'sem-2027-1', name: 'الفصل الدراسي الأول', startDate: '2027-09-01', endDate: '2028-01-20' },
      { id: 'sem-2027-2', name: 'الفصل الدراسي الثاني', startDate: '2028-02-05', endDate: '2028-06-30' },
    ],
    holidays: [],
    studentsCount: 0,
  },
  {
    id: 'ay-2024-2025',
    name: '2024/2025',
    startDate: '2024-09-01',
    endDate: '2025-06-30',
    status: 'ARCHIVED',
    semesters: [
      { id: 'sem-2024-1', name: 'الفصل الدراسي الأول', startDate: '2024-09-01', endDate: '2025-01-15' },
      { id: 'sem-2024-2', name: 'الفصل الدراسي الثاني', startDate: '2025-02-01', endDate: '2025-06-30' },
    ],
    holidays: [],
    studentsCount: 290,
  },
];

const statusConfig: Record<
  AcademicYearItem['status'],
  { label: string; tone: 'success' | 'info' | 'neutral' | 'danger' | 'warning' }
> = {
  CURRENT: { label: 'الحالية', tone: 'success' },
  UPCOMING: { label: 'القادمة', tone: 'info' },
  ENDED: { label: 'منتهية', tone: 'neutral' },
  ARCHIVED: { label: 'مؤرشفة', tone: 'warning' },
};

const holidayTypeLabels: Record<Holiday['type'], string> = {
  OFFICIAL: 'إجازة رسمية',
  DAY_OFF: 'يوم غير دراسي',
  VACATION_PERIOD: 'فترة إجازة',
};

export function AcademicYearsManager({ onBack }: { onBack?: () => void }) {
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>(initialAcademicYears);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingYear, setViewingYear] = useState<AcademicYearItem | null>(null);
  const [editingYear, setEditingYear] = useState<AcademicYearItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; year: AcademicYearItem | null }>({
    open: false,
    year: null,
  });
  const [notification, setNotification] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  // Clone options
  const [copyPrevious, setCopyPrevious] = useState(false);
  const [selectedPreviousYearId, setSelectedPreviousYearId] = useState<string>(initialAcademicYears[0]?.id || '');
  const [copyOptions, setCopyOptions] = useState({
    classes: true,
    stages: true,
    schedules: true,
    settings: true,
    notificationTemplates: true,
  });

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingYear(null);
    setName('2028/2029');
    setStartDate('2028-09-01');
    setEndDate('2029-06-30');
    setSemesters([
      { id: 'new-sem-1', name: 'الفصل الدراسي الأول', startDate: '2028-09-01', endDate: '2029-01-20' },
      { id: 'new-sem-2', name: 'الفصل الدراسي الثاني', startDate: '2029-02-05', endDate: '2029-06-30' },
    ]);
    setHolidays([]);
    setCopyPrevious(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (year: AcademicYearItem) => {
    setEditingYear(year);
    setName(year.name);
    setStartDate(year.startDate);
    setEndDate(year.endDate);
    setSemesters([...year.semesters]);
    setHolidays([...year.holidays]);
    setCopyPrevious(false);
    setModalOpen(true);
  };

  const handleSaveYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;

    if (editingYear) {
      setAcademicYears((prev) =>
        prev.map((y) =>
          y.id === editingYear.id
            ? { ...y, name, startDate, endDate, semesters, holidays }
            : y
        )
      );
      showNotification(`تم تعديل السنة الدراسية ${name} بنجاح.`);
    } else {
      const newYear: AcademicYearItem = {
        id: `ay-${Date.now()}`,
        name,
        startDate,
        endDate,
        status: 'UPCOMING',
        semesters,
        holidays,
        studentsCount: 0,
      };
      setAcademicYears((prev) => [newYear, ...prev]);
      showNotification(
        copyPrevious
          ? `تم إنشاء السنة الدراسية ${name} ونسخ إعدادات السنة المحددة بنجاح.`
          : `تم إنشاء السنة الدراسية ${name} بنجاح.`
      );
    }
    setModalOpen(false);
  };

  const handleSetActive = (year: AcademicYearItem) => {
    setAcademicYears((prev) =>
      prev.map((y) => ({
        ...y,
        status: y.id === year.id ? 'CURRENT' : y.status === 'CURRENT' ? 'ENDED' : y.status,
      }))
    );
    showNotification(`تم تعيين السنة الدراسية ${year.name} كسنة حالية.`);
  };

  const handleArchive = (year: AcademicYearItem) => {
    setAcademicYears((prev) =>
      prev.map((y) => (y.id === year.id ? { ...y, status: 'ARCHIVED' } : y))
    );
    showNotification(`تمت أرشفة السنة الدراسية ${year.name}.`);
  };

  const handleDelete = (year: AcademicYearItem) => {
    setAcademicYears((prev) => prev.filter((y) => y.id !== year.id));
    setDeleteConfirm({ open: false, year: null });
    showNotification(`تم حذف السنة الدراسية ${year.name}.`);
  };

  const addSemester = () => {
    const nextNum = semesters.length + 1;
    const arabicOrdinal = nextNum === 1 ? 'الأول' : nextNum === 2 ? 'الثاني' : nextNum === 3 ? 'الثالث' : `الـ ${nextNum}`;
    setSemesters((prev) => [
      ...prev,
      {
        id: `sem-${Date.now()}`,
        name: `الفصل الدراسي ${arabicOrdinal}`,
        startDate: '',
        endDate: '',
      },
    ]);
  };

  const removeSemester = (id: string) => {
    setSemesters((prev) => prev.filter((s) => s.id !== id));
  };

  const addHoliday = () => {
    setHolidays((prev) => [
      ...prev,
      {
        id: `hol-${Date.now()}`,
        name: 'إجازة جديدة',
        type: 'OFFICIAL',
        startDate: '',
        endDate: '',
      },
    ]);
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div className="academic-years-manager">
      {notification && (
        <div className="alert alert-success d-flex align-items-center gap-2 border-0 shadow-sm mb-3">
          <CheckCircle2 size={18} className="text-success" />
          <span>{notification}</span>
        </div>
      )}

      <Card className="panel">
        <div className="panel__header">
          <div>
            <div className="d-flex align-items-center gap-2">
              <CalendarDays className="text-primary" size={22} />
              <h2 className="panel__title">إدارة السنوات الدراسية</h2>
            </div>
            <p className="panel__subtitle">
              إضافة وتعيين السنة الحالية، تقسيم الفصول الدراسية وتحديد العطلات والإجازات الرسمية
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                العودة للإعدادات
              </Button>
            )}
            <Button onClick={handleOpenCreateModal}>
              <CalendarPlus size={18} /> سنة دراسية جديدة
            </Button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '22%' }}>السنة الدراسية</th>
                <th style={{ width: '18%' }}>تاريخ البداية</th>
                <th style={{ width: '18%' }}>تاريخ النهاية</th>
                <th style={{ width: '14%' }}>الحالة</th>
                <th style={{ width: '12%' }}>الفصول / الإجازات</th>
                <th style={{ width: '16%' }} className="text-start">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {academicYears.map((year) => {
                const isCurrent = year.status === 'CURRENT';
                return (
                  <tr key={year.id} className={isCurrent ? 'table-primary-subtle' : undefined}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold fs-6">{year.name}</span>
                        {isCurrent && (
                          <span className="badge bg-primary text-white rounded-pill px-2 py-1 small">
                            السنة النشطة
                          </span>
                        )}
                      </div>
                      {year.studentsCount !== undefined && year.studentsCount > 0 && (
                        <span className="text-muted small">({year.studentsCount} طالب مسجل)</span>
                      )}
                    </td>
                    <td className="ltr-value">{year.startDate}</td>
                    <td className="ltr-value">{year.endDate}</td>
                    <td>
                      <StatusBadge
                        label={statusConfig[year.status].label}
                        tone={statusConfig[year.status].tone}
                      />
                    </td>
                    <td>
                      <div className="small text-secondary">
                        <div>{year.semesters.length} فصول دراسية</div>
                        <div>{year.holidays.length} إجازات مسجلة</div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-light p-1"
                          title="عرض التفاصيل"
                          onClick={() => setViewingYear(year)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light p-1"
                          title="تعديل"
                          onClick={() => handleOpenEditModal(year)}
                        >
                          <Edit3 size={16} />
                        </button>
                        {!isCurrent && year.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary p-1"
                            title="تعيين كسنة حالية"
                            onClick={() => handleSetActive(year)}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {year.status !== 'ARCHIVED' && !isCurrent && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light p-1 text-warning"
                            title="أرشفة"
                            onClick={() => handleArchive(year)}
                          >
                            <Archive size={16} />
                          </button>
                        )}
                        {!isCurrent && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light p-1 text-danger"
                            title="حذف"
                            onClick={() => setDeleteConfirm({ open: true, year })}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {viewingYear && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <CalendarDays className="text-primary" size={22} />
                  <h5 className="modal-title fw-bold">تفاصيل السنة الدراسية {viewingYear.name}</h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() => setViewingYear(null)}
                />
              </div>
              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-secondary small">الفترة الدراسية</div>
                      <div className="fw-bold mt-1 ltr-value">
                        {viewingYear.startDate} إلى {viewingYear.endDate}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-secondary small">الحالة</div>
                      <div className="mt-1">
                        <StatusBadge
                          label={statusConfig[viewingYear.status].label}
                          tone={statusConfig[viewingYear.status].tone}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-secondary small">الطلاب المسجلين</div>
                      <div className="fw-bold mt-1 fs-5 text-primary">
                        {viewingYear.studentsCount ?? 0} طالب
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <Layers size={18} className="text-primary" /> الفصول الدراسية (
                    {viewingYear.semesters.length})
                  </h6>
                  {viewingYear.semesters.length === 0 ? (
                    <div className="text-muted small">لا توجد فصول دراسية محددة بعد.</div>
                  ) : (
                    <div className="row g-2">
                      {viewingYear.semesters.map((sem, idx) => (
                        <div className="col-md-6" key={sem.id}>
                          <div className="border rounded-3 p-3 h-100 bg-white">
                            <div className="fw-semibold text-primary">
                              {idx + 1}. {sem.name}
                            </div>
                            <div className="text-secondary small mt-1 ltr-value">
                              {sem.startDate || 'غير محدد'} ➔ {sem.endDate || 'غير محدد'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <Palmtree size={18} className="text-success" /> الإجازات والعطلات الرسمية (
                    {viewingYear.holidays.length})
                  </h6>
                  {viewingYear.holidays.length === 0 ? (
                    <div className="text-muted small">لا توجد إجازات مضافة لهذه السنة.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>اسم الإجازة</th>
                            <th>النوع</th>
                            <th>من تاريخ</th>
                            <th>إلى تاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingYear.holidays.map((hol) => (
                            <tr key={hol.id}>
                              <td className="fw-semibold">{hol.name}</td>
                              <td>
                                <span className="badge bg-secondary-subtle text-secondary-emphasis">
                                  {holidayTypeLabels[hol.type]}
                                </span>
                              </td>
                              <td className="ltr-value">{hol.startDate}</td>
                              <td className="ltr-value">{hol.endDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer border-top px-4 py-3">
                <Button variant="ghost" onClick={() => setViewingYear(null)}>
                  إغلاق
                </Button>
                <Button
                  onClick={() => {
                    const y = viewingYear;
                    setViewingYear(null);
                    handleOpenEditModal(y);
                  }}
                >
                  <Edit3 size={16} /> تعديل السنة
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <form className="modal-content border-0 rounded-4 shadow" onSubmit={handleSaveYear}>
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <CalendarPlus className="text-primary" size={22} />
                  <h5 className="modal-title fw-bold">
                    {editingYear ? `تعديل السنة الدراسية: ${editingYear.name}` : 'إضافة سنة دراسية جديدة'}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close m-0"
                  onClick={() => setModalOpen(false)}
                />
              </div>

              <div className="modal-body p-4">
                <h6 className="fw-bold text-secondary mb-3">1. البيانات الأساسية</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label">اسم السنة الدراسية *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="مثال: 2026/2027"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">تاريخ البداية *</label>
                    <input
                      type="date"
                      className="form-control ltr-value"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">تاريخ النهاية *</label>
                    <input
                      type="date"
                      className="form-control ltr-value"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {!editingYear && (
                  <div className="card bg-primary-subtle border-primary-subtle p-3 mb-4">
                    <div className="form-check form-switch mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="copyPrevSwitch"
                        checked={copyPrevious}
                        onChange={(e) => setCopyPrevious(e.target.checked)}
                      />
                      <label className="form-check-label fw-bold text-primary" htmlFor="copyPrevSwitch">
                        هل تريد نسخ إعدادات السنة السابقة؟
                      </label>
                    </div>

                    {copyPrevious && (
                      <div className="mt-2 pt-2 border-top border-primary-subtle">
                        <div className="mb-3">
                          <label className="form-label small text-secondary">اختر السنة المراد النسخ منها:</label>
                          <select
                            className="form-select form-select-sm"
                            value={selectedPreviousYearId}
                            onChange={(e) => setSelectedPreviousYearId(e.target.value)}
                          >
                            {academicYears.map((y) => (
                              <option key={y.id} value={y.id}>
                                {y.name} ({statusConfig[y.status].label})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="small text-secondary mb-2">العناصر التي سيتم نسخها:</div>
                        <div className="d-flex flex-wrap gap-3">
                          <label className="form-check form-check-inline small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={copyOptions.classes}
                              onChange={(e) =>
                                setCopyOptions({ ...copyOptions, classes: e.target.checked })
                              }
                            />
                            <span className="form-check-label">الفصول</span>
                          </label>
                          <label className="form-check-inline small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={copyOptions.stages}
                              onChange={(e) =>
                                setCopyOptions({ ...copyOptions, stages: e.target.checked })
                              }
                            />
                            <span className="form-check-label">الصفوف والمراحل</span>
                          </label>
                          <label className="form-check-inline small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={copyOptions.schedules}
                              onChange={(e) =>
                                setCopyOptions({ ...copyOptions, schedules: e.target.checked })
                              }
                            />
                            <span className="form-check-label">الجداول والمواعيد</span>
                          </label>
                          <label className="form-check-inline small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={copyOptions.settings}
                              onChange={(e) =>
                                setCopyOptions({ ...copyOptions, settings: e.target.checked })
                              }
                            />
                            <span className="form-check-label">الإعدادات وقواعد الحضور</span>
                          </label>
                          <label className="form-check-inline small">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={copyOptions.notificationTemplates}
                              onChange={(e) =>
                                setCopyOptions({
                                  ...copyOptions,
                                  notificationTemplates: e.target.checked,
                                })
                              }
                            />
                            <span className="form-check-label">قوالب الإشعارات والرسائل</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="fw-bold text-secondary mb-0">2. تقسيم الفصول الدراسية</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={addSemester}
                    >
                      <Plus size={14} /> إضافة فصل دراسي
                    </button>
                  </div>

                  {semesters.length === 0 ? (
                    <div className="p-3 border border-dashed rounded-3 text-center text-muted small">
                      لم يتم إضافة فصول دراسية بعد. اضغط زر &quot;إضافة فصل دراسي&quot; لإضافة ترم أو فصل.
                    </div>
                  ) : (
                    <div className="d-grid gap-2">
                      {semesters.map((sem, idx) => (
                        <div
                          key={sem.id}
                          className="d-flex align-items-center gap-2 p-2 border rounded-3 bg-light"
                        >
                          <div className="flex-grow-1">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="اسم الفصل الدراسي"
                              value={sem.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSemesters((prev) =>
                                  prev.map((s) => (s.id === sem.id ? { ...s, name: val } : s))
                                );
                              }}
                            />
                          </div>
                          <div style={{ width: '180px' }}>
                            <input
                              type="date"
                              className="form-control form-control-sm ltr-value"
                              title="تاريخ البداية"
                              value={sem.startDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSemesters((prev) =>
                                  prev.map((s) => (s.id === sem.id ? { ...s, startDate: val } : s))
                                );
                              }}
                            />
                          </div>
                          <span className="text-secondary small">إلى</span>
                          <div style={{ width: '180px' }}>
                            <input
                              type="date"
                              className="form-control form-control-sm ltr-value"
                              title="تاريخ النهاية"
                              value={sem.endDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSemesters((prev) =>
                                  prev.map((s) => (s.id === sem.id ? { ...s, endDate: val } : s))
                                );
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger p-1"
                            onClick={() => removeSemester(sem.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="fw-bold text-secondary mb-0">3. الإجازات والأيام غير الدراسية</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={addHoliday}
                    >
                      <Plus size={14} /> إضافة إجازة
                    </button>
                  </div>

                  {holidays.length === 0 ? (
                    <div className="p-3 border border-dashed rounded-3 text-center text-muted small">
                      لا توجد إجازات مضافة حاليًا. يمكنك إضافة الإجازات الرسمية والعطلات الموسمية.
                    </div>
                  ) : (
                    <div className="d-grid gap-2">
                      {holidays.map((hol) => (
                        <div
                          key={hol.id}
                          className="d-flex align-items-center gap-2 p-2 border rounded-3 bg-light"
                        >
                          <div className="flex-grow-1">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="اسم الإجازة"
                              value={hol.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setHolidays((prev) =>
                                  prev.map((h) => (h.id === hol.id ? { ...h, name: val } : h))
                                );
                              }}
                            />
                          </div>
                          <div style={{ width: '150px' }}>
                            <select
                              className="form-select form-select-sm"
                              value={hol.type}
                              onChange={(e) => {
                                const val = e.target.value as Holiday['type'];
                                setHolidays((prev) =>
                                  prev.map((h) => (h.id === hol.id ? { ...h, type: val } : h))
                                );
                              }}
                            >
                              <option value="OFFICIAL">إجازة رسمية</option>
                              <option value="DAY_OFF">يوم غير دراسي</option>
                              <option value="VACATION_PERIOD">فترة إجازة</option>
                            </select>
                          </div>
                          <div style={{ width: '160px' }}>
                            <input
                              type="date"
                              className="form-control form-control-sm ltr-value"
                              title="من تاريخ"
                              value={hol.startDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setHolidays((prev) =>
                                  prev.map((h) => (h.id === hol.id ? { ...h, startDate: val } : h))
                                );
                              }}
                            />
                          </div>
                          <span className="text-secondary small">إلى</span>
                          <div style={{ width: '160px' }}>
                            <input
                              type="date"
                              className="form-control form-control-sm ltr-value"
                              title="إلى تاريخ"
                              value={hol.endDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setHolidays((prev) =>
                                  prev.map((h) => (h.id === hol.id ? { ...h, endDate: val } : h))
                                );
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-danger p-1"
                            onClick={() => removeHoliday(hol.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-top px-4 py-3">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit">
                  {editingYear ? 'حفظ التعديلات' : 'إنشاء السنة الدراسية'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title={`حذف السنة الدراسية (${deleteConfirm.year?.name})`}
        message={
          deleteConfirm.year?.studentsCount && deleteConfirm.year.studentsCount > 0
            ? `تنبيه هام: هذه السنة تحتوي على (${deleteConfirm.year.studentsCount}) طالب وسجلات درجات مرتبطة. حذف السنة قد يؤثر على التقارير السابقة. هل أنت متأكد من الحذف النهائي؟`
            : 'هل أنت متأكد من رغبتك في حذف هذه السنة الدراسية؟ لا يمكن التراجع عن هذا الإجراء.'
        }
        confirmLabel="تأكيد الحذف"
        destructive
        onClose={() => setDeleteConfirm({ open: false, year: null })}
        onConfirm={() => {
          if (deleteConfirm.year) handleDelete(deleteConfirm.year);
        }}
      />
    </div>
  );
}
