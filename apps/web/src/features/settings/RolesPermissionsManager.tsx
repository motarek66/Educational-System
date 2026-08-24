import { useMemo, useState } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Edit3,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatusBadge } from '../../components/ui/StatusBadge';

export type PermissionItem = {
  key: string;
  label: string;
  isViewOnly?: boolean;
};

export type PermissionModule = {
  id: string;
  title: string;
  description: string;
  permissions: PermissionItem[];
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: 'students',
    title: 'الطلاب',
    description: 'إدارة ملفات الطلاب وسجلاتهم الأكاديمية وبيانات أولياء الأمور',
    permissions: [
      { key: 'students.view', label: 'عرض', isViewOnly: true },
      { key: 'students.create', label: 'إضافة' },
      { key: 'students.update', label: 'تعديل' },
      { key: 'students.delete', label: 'حذف' },
      { key: 'students.export', label: 'تصدير' },
    ],
  },
  {
    id: 'attendance',
    title: 'الحضور والانصراف',
    description: 'تسجيل الحضور عبر QR/الكود وتعديل السجلات وإصدار التقارير',
    permissions: [
      { key: 'attendance.view', label: 'عرض الحضور', isViewOnly: true },
      { key: 'attendance.scan', label: 'تسجيل الحضور' },
      { key: 'attendance.update', label: 'تعديل الحضور' },
      { key: 'attendance.delete', label: 'حذف سجل حضور' },
      { key: 'attendance.export', label: 'تصدير التقارير' },
    ],
  },
  {
    id: 'classes',
    title: 'الفصول والسناتر',
    description: 'إدارة الفصول والمجموعات وقاعات التدريس بالسناتر',
    permissions: [
      { key: 'classes.view', label: 'عرض', isViewOnly: true },
      { key: 'classes.create', label: 'إضافة' },
      { key: 'classes.update', label: 'تعديل' },
      { key: 'classes.delete', label: 'حذف' },
    ],
  },
  {
    id: 'schedules',
    title: 'الجداول والمواعيد',
    description: 'إعداد جداول الحصص الأسبوعية والمواعيد',
    permissions: [
      { key: 'schedules.view', label: 'عرض', isViewOnly: true },
      { key: 'schedules.create', label: 'إضافة' },
      { key: 'schedules.update', label: 'تعديل' },
      { key: 'schedules.delete', label: 'حذف' },
    ],
  },
  {
    id: 'reports',
    title: 'التقارير',
    description: 'الاطلاع على التحليلات واستخراج التقارير والطباعة',
    permissions: [
      { key: 'reports.view', label: 'عرض', isViewOnly: true },
      { key: 'reports.export', label: 'تصدير' },
      { key: 'reports.print', label: 'طباعة' },
    ],
  },
  {
    id: 'users',
    title: 'المستخدمون',
    description: 'إدارة حسابات المعلمين والمشرفين ومساعدي التدريس',
    permissions: [
      { key: 'users.view', label: 'عرض', isViewOnly: true },
      { key: 'users.create', label: 'إضافة' },
      { key: 'users.update', label: 'تعديل' },
      { key: 'users.delete', label: 'حذف' },
      { key: 'users.change_roles', label: 'تغيير الأدوار' },
    ],
  },
  {
    id: 'notifications',
    title: 'الإشعارات',
    description: 'إرسال وتجهيز الإشعارات الفورية للطلاب وأولياء الأمور',
    permissions: [
      { key: 'notifications.view', label: 'عرض', isViewOnly: true },
      { key: 'notifications.create', label: 'إنشاء' },
      { key: 'notifications.update', label: 'تعديل' },
      { key: 'notifications.delete', label: 'حذف' },
      { key: 'notifications.send', label: 'إرسال' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'قوالب واتساب',
    description: 'إدارة وتخصيص قوالب رسائل الواتساب وقواعد الإرسال الآلي',
    permissions: [
      { key: 'whatsapp.view', label: 'عرض', isViewOnly: true },
      { key: 'whatsapp.create', label: 'إنشاء' },
      { key: 'whatsapp.update', label: 'تعديل' },
      { key: 'whatsapp.delete', label: 'حذف' },
      { key: 'whatsapp.toggle', label: 'تشغيل / إيقاف' },
    ],
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    description: 'إعدادات النظام العامة، السنوات الدراسية، النسخ الاحتياطي والصلاحيات',
    permissions: [
      { key: 'settings.view', label: 'عرض الإعدادات', isViewOnly: true },
      { key: 'settings.update', label: 'تعديل الإعدادات' },
      { key: 'settings.academic_years', label: 'إدارة السنة الدراسية' },
      { key: 'settings.backup', label: 'إدارة النسخ الاحتياطي' },
      { key: 'settings.permissions', label: 'إدارة الصلاحيات' },
    ],
  },
];

export type RoleItem = {
  id: string;
  name: string;
  description: string;
  usersCount: number;
  type: 'DEFAULT' | 'CUSTOM';
  status: 'ACTIVE' | 'INACTIVE';
  permissionKeys: string[];
};

const allAvailablePermissionKeys = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map((p) => p.key)
);
const viewOnlyPermissionKeys = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.filter((p) => p.isViewOnly).map((p) => p.key)
);

const initialRoles: RoleItem[] = [
  {
    id: 'role-superadmin',
    name: 'مدير النظام',
    description: 'صلاحيات كاملة وغير مقيدة على كافة أقسام وإعدادات النظام',
    usersCount: 2,
    type: 'DEFAULT',
    status: 'ACTIVE',
    permissionKeys: [...allAvailablePermissionKeys],
  },
  {
    id: 'role-attendance',
    name: 'مشرف حضور',
    description: 'تسجيل الحضور ومتابعة الغياب وطباعة تقارير الحضور داخل السناتر',
    usersCount: 5,
    type: 'CUSTOM',
    status: 'ACTIVE',
    permissionKeys: [
      'students.view',
      'attendance.view',
      'attendance.scan',
      'attendance.update',
      'attendance.export',
      'classes.view',
      'reports.view',
      'reports.export',
      'notifications.view',
      'notifications.send',
    ],
  },
  {
    id: 'role-teacher',
    name: 'معلم',
    description: 'الاطلاع على الطلاب، إدخال الدرجات والامتحانات واستعراض الجداول',
    usersCount: 42,
    type: 'DEFAULT',
    status: 'ACTIVE',
    permissionKeys: [
      'students.view',
      'attendance.view',
      'classes.view',
      'schedules.view',
      'reports.view',
      'reports.print',
      'notifications.view',
      'whatsapp.view',
    ],
  },
  {
    id: 'role-assistant',
    name: 'مساعد إداري',
    description: 'إدخال الطلاب الجدد والتواصل عبر قوالب واتساب وإصدار التقارير',
    usersCount: 8,
    type: 'CUSTOM',
    status: 'ACTIVE',
    permissionKeys: [
      'students.view',
      'students.create',
      'students.update',
      'attendance.view',
      'attendance.scan',
      'classes.view',
      'reports.view',
      'notifications.view',
      'notifications.send',
      'whatsapp.view',
    ],
  },
  {
    id: 'role-auditor',
    name: 'مراجع مالي وإداري',
    description: 'صلاحية قراءة فقط للاطلاع على كافة التقارير والحضور دون إمكانية التعديل',
    usersCount: 1,
    type: 'CUSTOM',
    status: 'INACTIVE',
    permissionKeys: [...viewOnlyPermissionKeys],
  },
];

export function RolesPermissionsManager({ onBack }: { onBack?: () => void }) {
  const [roles, setRoles] = useState<RoleItem[]>(initialRoles);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEFAULT' | 'CUSTOM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; role: RoleItem | null }>({
    open: false,
    role: null,
  });
  const [notification, setNotification] = useState<string | null>(null);

  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleStatus, setRoleStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [cloneFromRoleId, setCloneFromRoleId] = useState<string>('');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === 'ALL' || r.type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [roles, searchQuery, typeFilter, statusFilter]);

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setRoleStatus('ACTIVE');
    setSelectedKeys([]);
    setCloneFromRoleId('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (role: RoleItem) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description);
    setRoleStatus(role.status);
    setSelectedKeys([...role.permissionKeys]);
    setCloneFromRoleId('');
    setModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    if (editingRole) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id
            ? {
                ...r,
                name: roleName.trim(),
                description: roleDesc.trim(),
                status: roleStatus,
                permissionKeys: selectedKeys,
              }
            : r
        )
      );
      showNotification(`تم تحديث الدور "${roleName}" بنجاح.`);
    } else {
      const newRole: RoleItem = {
        id: `role-${Date.now()}`,
        name: roleName.trim(),
        description: roleDesc.trim(),
        usersCount: 0,
        type: 'CUSTOM',
        status: roleStatus,
        permissionKeys: selectedKeys,
      };
      setRoles((prev) => [newRole, ...prev]);
      showNotification(`تم إنشاء الدور الجديد "${roleName}" بنجاح.`);
    }
    setModalOpen(false);
  };

  const handleDeleteRole = (role: RoleItem) => {
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    setDeleteConfirm({ open: false, role: null });
    showNotification(`تم حذف الدور "${role.name}" بنجاح.`);
  };

  const togglePermission = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleModulePermissions = (module: PermissionModule) => {
    const moduleKeys = module.permissions.map((p) => p.key);
    const allSelected = moduleKeys.every((k) => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys((prev) => prev.filter((k) => !moduleKeys.includes(k)));
    } else {
      setSelectedKeys((prev) => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  const handleSelectAll = () => {
    setSelectedKeys([...allAvailablePermissionKeys]);
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  const handleApplyViewOnly = () => {
    setSelectedKeys([...viewOnlyPermissionKeys]);
  };

  const handleClonePermissions = (fromId: string) => {
    if (!fromId) return;
    const target = roles.find((r) => r.id === fromId);
    if (target) {
      setSelectedKeys([...target.permissionKeys]);
      showNotification(`تم نسخ صلاحيات دور "${target.name}".`);
    }
  };

  return (
    <div className="roles-permissions-manager">
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
              <KeyRound className="text-primary" size={22} />
              <h2 className="panel__title">الأدوار والصلاحيات (Roles & Permissions)</h2>
            </div>
            <p className="panel__subtitle">
              إدارة مجموعات الصلاحيات المخصصة، وتوزيع الصلاحيات حسب المهام الوظيفية
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                العودة للإعدادات
              </Button>
            )}
            <Button onClick={handleOpenCreateModal}>
              <Plus size={18} /> دور جديد
            </Button>
          </div>
        </div>

        <div className="toolbar bg-light rounded-3 mb-3 p-3">
          <div className="search-field">
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="بحث باسم الدور أو الوصف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} />
          </div>

          <div className="toolbar__filters">
            <div className="d-flex align-items-center gap-1">
              <span className="small text-secondary">النوع:</span>
              <select
                className="form-select form-select-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{ width: '120px' }}
              >
                <option value="ALL">الكل</option>
                <option value="DEFAULT">افتراضي</option>
                <option value="CUSTOM">مخصص</option>
              </select>
            </div>

            <div className="d-flex align-items-center gap-1">
              <span className="small text-secondary">الحالة:</span>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{ width: '120px' }}
              >
                <option value="ALL">الكل</option>
                <option value="ACTIVE">مفعل</option>
                <option value="INACTIVE">غير مفعل</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '28%' }}>الدور</th>
                <th style={{ width: '16%' }}>عدد المستخدمين</th>
                <th style={{ width: '14%' }}>النوع</th>
                <th style={{ width: '14%' }}>الحالة</th>
                <th style={{ width: '16%' }}>الصلاحيات</th>
                <th style={{ width: '12%' }} className="text-start">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    لا توجد أدوار تطابق معايير البحث والفلترة.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold fs-6">{role.name}</span>
                          {role.type === 'DEFAULT' && (
                            <span className="badge bg-secondary-subtle text-secondary-emphasis small">
                              نظامي
                            </span>
                          )}
                        </div>
                        <div className="text-secondary small mt-1">{role.description}</div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <Users size={16} className="text-primary" />
                        <span className="fw-bold">{role.usersCount}</span>
                        <span className="text-muted small">مستخدم</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          role.type === 'DEFAULT'
                            ? 'bg-info-subtle text-info-emphasis'
                            : 'bg-primary-subtle text-primary-emphasis'
                        }`}
                      >
                        {role.type === 'DEFAULT' ? 'افتراضي' : 'مخصص'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        label={role.status === 'ACTIVE' ? 'مفعل' : 'غير مفعل'}
                        tone={role.status === 'ACTIVE' ? 'success' : 'neutral'}
                      />
                    </td>
                    <td>
                      <span className="small text-secondary fw-semibold">
                        {role.permissionKeys.length} من {allAvailablePermissionKeys.length} صلاحية
                      </span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-light p-1"
                          title="تعديل الصلاحيات"
                          onClick={() => handleOpenEditModal(role)}
                        >
                          <Edit3 size={16} />
                        </button>
                        {role.type === 'CUSTOM' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-light p-1 text-danger"
                            title="حذف الدور"
                            onClick={() => setDeleteConfirm({ open: true, role })}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
            <form className="modal-content border-0 rounded-4 shadow" onSubmit={handleSaveRole}>
              <div className="modal-header border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <ShieldCheck className="text-primary" size={24} />
                  <h5 className="modal-title fw-bold">
                    {editingRole ? `تعديل الدور: ${editingRole.name}` : 'إنشاء دور جديد'}
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
                  <div className="col-md-6">
                    <label className="form-label">اسم الدور *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="مثال: مشرف حضور، مسؤول سنتر، معلم مساعد"
                      required
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">حالة الدور</label>
                    <select
                      className="form-select"
                      value={roleStatus}
                      onChange={(e) => setRoleStatus(e.target.value as any)}
                    >
                      <option value="ACTIVE">مفعل</option>
                      <option value="INACTIVE">غير مفعل</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">نسخ صلاحيات من دور:</label>
                    <select
                      className="form-select"
                      value={cloneFromRoleId}
                      onChange={(e) => {
                        setCloneFromRoleId(e.target.value);
                        handleClonePermissions(e.target.value);
                      }}
                    >
                      <option value="">-- اختر دوراً للنسخ --</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.permissionKeys.length} صلاحية)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">وصف الدور</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="وصف مختصر للمسؤوليات الموكلة لهذا الدور..."
                      value={roleDesc}
                      onChange={(e) => setRoleDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom">
                  <div>
                    <h6 className="fw-bold text-secondary mb-0">2. جدول الصلاحيات الممنوحة</h6>
                    <small className="text-muted">
                      محدد حالياً ({selectedKeys.length}) من ({allAvailablePermissionKeys.length}) صلاحية
                    </small>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleSelectAll}
                    >
                      <CheckSquare size={14} /> تحديد الكل
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleApplyViewOnly}
                    >
                      <Eye size={14} /> عرض فقط
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={handleDeselectAll}
                    >
                      <Square size={14} /> إلغاء تحديد الكل
                    </button>
                  </div>
                </div>

                <div className="row g-3">
                  {PERMISSION_MODULES.map((module) => {
                    const moduleKeys = module.permissions.map((p) => p.key);
                    const selectedInModule = moduleKeys.filter((k) =>
                      selectedKeys.includes(k)
                    ).length;
                    const allInModuleSelected = selectedInModule === moduleKeys.length;
                    const someInModuleSelected =
                      selectedInModule > 0 && selectedInModule < moduleKeys.length;

                    return (
                      <div className="col-lg-6" key={module.id}>
                        <div className="card h-100 border rounded-3 p-3 bg-white">
                          <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                            <div>
                              <span className="fw-bold fs-6 text-dark">{module.title}</span>
                              <div className="text-secondary small" style={{ fontSize: '0.8rem' }}>
                                {module.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`btn btn-sm ${
                                allInModuleSelected
                                  ? 'btn-primary'
                                  : someInModuleSelected
                                  ? 'btn-outline-primary'
                                  : 'btn-outline-secondary'
                              } px-2 py-1 small`}
                              onClick={() => toggleModulePermissions(module)}
                            >
                              {allInModuleSelected ? 'إلغاء القسم' : 'تحديد القسم'}
                            </button>
                          </div>

                          <div className="d-flex flex-wrap gap-3 pt-2">
                            {module.permissions.map((perm) => {
                              const checked = selectedKeys.includes(perm.key);
                              return (
                                <label
                                  key={perm.key}
                                  className={`form-check-label d-inline-flex align-items-center gap-2 p-2 rounded-2 border cursor-pointer ${
                                    checked
                                      ? 'bg-primary-subtle border-primary text-primary-emphasis'
                                      : 'bg-light text-secondary'
                                  }`}
                                  style={{ cursor: 'pointer', minWidth: '110px' }}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={checked}
                                    onChange={() => togglePermission(perm.key)}
                                  />
                                  <span className="small fw-semibold">{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer border-top px-4 py-3">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit">
                  {editingRole ? 'حفظ الصلاحيات' : 'إنشاء الدور'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title={`حذف الدور (${deleteConfirm.role?.name})`}
        message={
          deleteConfirm.role?.usersCount && deleteConfirm.role.usersCount > 0
            ? `تنبيه: هذا الدور مرتبط بـ (${deleteConfirm.role.usersCount}) مستخدم. يرجى إعادة تعيين أدوار المستخدمين أولاً قبل الحذف. هل تريد المتابعة على أي حال؟`
            : 'هل أنت متأكد من رغبتك في حذف هذا الدور المخصص نهائياً؟'
        }
        confirmLabel="تأكيد الحذف"
        destructive
        onClose={() => setDeleteConfirm({ open: false, role: null })}
        onConfirm={() => {
          if (deleteConfirm.role) handleDeleteRole(deleteConfirm.role);
        }}
      />
    </div>
  );
}
