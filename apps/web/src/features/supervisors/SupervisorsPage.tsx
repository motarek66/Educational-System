import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, KeyRound, Plus, Save, ShieldCheck, Square, UserCog, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';

type Supervisor = { id: string; fullName: string; email: string | null; phoneE164: string; status: 'ACTIVE' | 'SUSPENDED' | 'INVITED'; roles: string[]; centers: string[] };
type Role = { id: string; name: string; permissions: Array<{ permission: { key: string } }> };
type Center = { id: string; name: string };
type Permission = { id: string; key: string; label: string };

const PERMISSION_GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: 'الطلاب', keys: ['students.view', 'students.create', 'students.update', 'students.delete', 'students.export'] },
  { title: 'الحضور', keys: ['attendance.view', 'attendance.scan', 'attendance.update', 'attendance.delete', 'attendance.export'] },
  { title: 'الحصص والدرجات', keys: ['lessons.view', 'lessons.start', 'lessons.close', 'lessons.grade'] },
  { title: 'التقارير', keys: ['reports.view', 'reports.export', 'reports.print'] },
  { title: 'المستخدمون', keys: ['users.view', 'users.create', 'users.update', 'users.delete'] },
  { title: 'الإعدادات', keys: ['settings.view', 'settings.update', 'settings.academic_years', 'settings.backup', 'settings.permissions'] },
];

const PERM_LABELS: Record<string, string> = {
  'students.view': 'عرض', 'students.create': 'إضافة', 'students.update': 'تعديل', 'students.delete': 'حذف', 'students.export': 'تصدير',
  'attendance.view': 'عرض', 'attendance.scan': 'تسجيل حضور', 'attendance.update': 'تعديل', 'attendance.delete': 'حذف', 'attendance.export': 'تصدير',
  'lessons.view': 'عرض', 'lessons.start': 'بدء حصة', 'lessons.close': 'إغلاق حصة', 'lessons.grade': 'إدخال درجات',
  'reports.view': 'عرض', 'reports.export': 'تصدير', 'reports.print': 'طباعة',
  'users.view': 'عرض', 'users.create': 'إضافة', 'users.update': 'تعديل', 'users.delete': 'حذف',
  'settings.view': 'عرض', 'settings.update': 'تعديل', 'settings.academic_years': 'السنة الدراسية', 'settings.backup': 'النسخ الاحتياطي', 'settings.permissions': 'الصلاحيات',
};

function AddSupervisorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<ApiResponse<Role[]>>('/roles')).data.data });
  const centersQuery = useQuery({ queryKey: ['centers'], queryFn: async () => (await api.get<ApiResponse<Center[]>>('/centers')).data.data });
  const mutation = useMutation({
    mutationFn: () => api.post('/users', { fullName: fullName.trim(), email: email.trim() || undefined, phoneE164: email.trim() || '+201000000000', temporaryPassword: password, roleIds: selectedRoleId ? [selectedRoleId] : [], centerIds: selectedCenterIds }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['users', 'supervisors'] }); onClose(); },
  });
  const toggleCenter = (id: string) => setSelectedCenterIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <form className="modal-content border-0 rounded-4 shadow" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="modal-header border-bottom px-4 py-3">
            <div className="d-flex align-items-center gap-2"><UserCog className="text-primary" size={22} /><h5 className="modal-title fw-bold mb-0">إضافة مشرف جديد</h5></div>
            <button type="button" className="btn-close m-0" onClick={onClose} />
          </div>
          <div className="modal-body p-4">
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label">الاسم الكامل *</label><input className="form-control" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="محمد أحمد علي" /></div>
              <div className="col-md-6"><label className="form-label">البريد الإلكتروني *</label><input className="form-control ltr-value" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supervisor@example.com" /></div>
              <div className="col-md-6">
                <label className="form-label">كلمة المرور المؤقتة *</label>
                <input className="form-control ltr-value" type="text" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="12 حرف على الأقل" />
                <div className="form-text">سيطلب النظام تغييرها عند أول دخول.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label">الدور</label>
                <select className="form-select" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
                  <option value="">-- بدون دور --</option>
                  {rolesQuery.data?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">السناتر المتاحة</label>
                <div className="d-flex flex-wrap gap-2 p-3 rounded-3" style={{ background: 'var(--surface-subtle)' }}>
                  {centersQuery.isLoading ? <span className="text-secondary small">جاري التحميل...</span> : null}
                  {centersQuery.data?.map((center) => (
                    <label key={center.id} className={`d-flex align-items-center gap-2 px-3 py-2 rounded-3 border small fw-semibold ${selectedCenterIds.includes(center.id) ? 'bg-primary text-white border-primary' : 'bg-white text-secondary'}`} style={{ cursor: 'pointer' }}>
                      <input type="checkbox" className="d-none" checked={selectedCenterIds.includes(center.id)} onChange={() => toggleCenter(center.id)} />{center.name}
                    </label>
                  ))}
                  {centersQuery.data?.length === 0 ? <span className="text-secondary small">لا توجد سناتر.</span> : null}
                </div>
                {selectedCenterIds.length === 0 && <div className="form-text">إذا لم تحدد سنتراً، سيتمكن المشرف من الوصول لكل السناتر.</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer border-top px-4 py-3 d-flex justify-content-between">
            {mutation.isError ? <span className="text-danger small">{getApiErrorMessage(mutation.error)}</span> : <span />}
            <div className="d-flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button><Button type="submit" loading={mutation.isPending}><Plus size={17} /> إضافة المشرف</Button></div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermissionsModal({ supervisor, onClose }: { supervisor: Supervisor; onClose: () => void }) {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<ApiResponse<Role[]>>('/roles')).data.data });
  const allPermsQuery = useQuery({ queryKey: ['permissions'], queryFn: async () => (await api.get<ApiResponse<Permission[]>>('/permissions')).data.data });
  const supervisorRole = rolesQuery.data?.find((r) => supervisor.roles.includes(r.name));
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (supervisorRole && !initialized) { setSelectedRoleId(supervisorRole.id); setSelectedKeys(supervisorRole.permissions.map((p) => p.permission.key)); setInitialized(true); }
  }, [supervisorRole, initialized]);
  const mutation = useMutation({
    mutationFn: () => { if (!selectedRoleId) return Promise.reject(new Error('اختر دورًا أولًا.')); return api.put(`/roles/${selectedRoleId}/permissions`, { permissionKeys: selectedKeys }); },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['roles'] }); void queryClient.invalidateQueries({ queryKey: ['users', 'supervisors'] }); onClose(); },
  });
  const availableKeys = allPermsQuery.data?.map((p) => p.key) ?? PERMISSION_GROUPS.flatMap((g) => g.keys);
  const toggleKey = (key: string) => setSelectedKeys((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  const toggleGroup = (keys: string[]) => {
    const allIn = keys.every((k) => selectedKeys.includes(k));
    if (allIn) setSelectedKeys((prev) => prev.filter((k) => !keys.includes(k)));
    else setSelectedKeys((prev) => Array.from(new Set([...prev, ...keys])));
  };
  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 rounded-4 shadow">
          <div className="modal-header border-bottom px-4 py-3">
            <div className="d-flex align-items-center gap-2"><ShieldCheck className="text-primary" size={22} /><div><h5 className="modal-title fw-bold mb-0">إدارة الصلاحيات</h5><div className="text-secondary small">{supervisor.fullName}</div></div></div>
            <button type="button" className="btn-close m-0" onClick={onClose} />
          </div>
          <div className="modal-body p-4">
            <div className="mb-4">
              <label className="form-label fw-semibold">الدور المرتبط</label>
              <select className="form-select" value={selectedRoleId} onChange={(e) => { const roleId = e.target.value; setSelectedRoleId(roleId); const role = rolesQuery.data?.find((r) => r.id === roleId); setSelectedKeys(role ? role.permissions.map((p) => p.permission.key) : []); }}>
                <option value="">-- اختر دوراً --</option>
                {rolesQuery.data?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom">
              <div><span className="fw-semibold text-secondary small">جدول الصلاحيات</span><span className="text-muted small me-2">— {selectedKeys.length} من {availableKeys.length} محددة</span></div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setSelectedKeys([...availableKeys])}><CheckSquare size={14} /> تحديد الكل</button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setSelectedKeys([])}><Square size={14} /> إلغاء الكل</button>
              </div>
            </div>
            <div className="row g-3">
              {PERMISSION_GROUPS.map((group) => {
                const allIn = group.keys.every((k) => selectedKeys.includes(k));
                const someIn = group.keys.some((k) => selectedKeys.includes(k));
                return (
                  <div key={group.title} className="col-md-6">
                    <div className="card h-100 border rounded-3 p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                        <span className="fw-bold">{group.title}</span>
                        <button type="button" className={`btn btn-sm px-2 py-1 small ${allIn ? 'btn-primary' : someIn ? 'btn-outline-primary' : 'btn-outline-secondary'}`} onClick={() => toggleGroup(group.keys)}>{allIn ? 'إلغاء القسم' : 'تحديد القسم'}</button>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {group.keys.map((key) => { const checked = selectedKeys.includes(key); return (
                          <label key={key} className={`d-inline-flex align-items-center gap-2 p-2 rounded-2 border small fw-semibold ${checked ? 'bg-primary-subtle border-primary text-primary-emphasis' : 'bg-light text-secondary'}`} style={{ cursor: 'pointer', minWidth: 100 }}>
                            <input type="checkbox" className="form-check-input mt-0" checked={checked} onChange={() => toggleKey(key)} />{PERM_LABELS[key] ?? key.split('.')[1]}
                          </label>
                        ); })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-footer border-top px-4 py-3 d-flex justify-content-between">
            {mutation.isError ? <span className="text-danger small">{getApiErrorMessage(mutation.error)}</span> : <span />}
            <div className="d-flex gap-2"><Button variant="ghost" onClick={onClose}><X size={16} /> إغلاق</Button><Button disabled={!selectedRoleId || mutation.isPending} loading={mutation.isPending} onClick={() => mutation.mutate()}><Save size={17} /> حفظ الصلاحيات</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SupervisorsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [permsSupervisor, setPermsSupervisor] = useState<Supervisor | null>(null);
  const query = useQuery({ queryKey: ['users', 'supervisors'], queryFn: async () => (await api.get<ApiResponse<Supervisor[]>>('/users', { params: { type: 'supervisor' } })).data.data });
  return (
    <>
      <PageHeader title="المشرفون والصلاحيات" subtitle="أضف المشرفين وحدد أدوارهم والسناتر المسموح بها." actions={<Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة مشرف</Button>} />
      <div className="row g-3 mb-3">
        <div className="col-md-6"><Card className="panel d-flex align-items-center justify-content-between"><div><div className="text-secondary small">المستخدمون النشطون</div><div className="fs-2 mt-2">{query.data?.filter((item) => item.status === 'ACTIVE').length ?? 0}</div></div><div className="metric-card__icon"><UserCog size={21} /></div></Card></div>
        <div className="col-md-6"><Card className="panel d-flex align-items-center justify-content-between"><div><div className="text-secondary small">الأدوار المخصصة</div><div className="fs-2 mt-2">{new Set(query.data?.flatMap((item) => item.roles) ?? []).size}</div></div><div className="metric-card__icon"><ShieldCheck size={21} /></div></Card></div>
      </div>
      {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? <Card className="skeleton" style={{ height: 400 }} /> : null}
      {!query.isLoading && !query.isError && query.data?.length === 0 ? <EmptyState title="لا يوجد مشرفون" description="أضف مشرفًا وحدد الدور والنطاق قبل إرسال بيانات الدخول." action={<Button onClick={() => setAddOpen(true)}><Plus size={18} /> إضافة مشرف</Button>} /> : null}
      {query.data && query.data.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="table-responsive p-3">
            <table className="table align-middle">
              <thead><tr><th>المستخدم</th><th>الدور</th><th>السناتر</th><th>الحالة</th><th /></tr></thead>
              <tbody>{query.data.map((supervisor) => (
                <tr key={supervisor.id}>
                  <td><div className="fw-semibold">{supervisor.fullName}</div><div className="text-secondary small ltr-value">{supervisor.email ?? supervisor.phoneE164}</div></td>
                  <td>{supervisor.roles.join('، ') || <span className="text-secondary small">بدون دور</span>}</td>
                  <td>{supervisor.centers.join('، ') || <span className="text-secondary small">كل السناتر</span>}</td>
                  <td><StatusBadge label={supervisor.status === 'ACTIVE' ? 'نشط' : supervisor.status === 'INVITED' ? 'دعوة معلقة' : 'موقوف'} tone={supervisor.status === 'ACTIVE' ? 'success' : supervisor.status === 'INVITED' ? 'info' : 'danger'} /></td>
                  <td><Button variant="ghost" onClick={() => setPermsSupervisor(supervisor)}><KeyRound size={17} /> إدارة الصلاحيات</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      ) : null}
      {addOpen ? <AddSupervisorModal onClose={() => setAddOpen(false)} /> : null}
      {permsSupervisor ? <PermissionsModal supervisor={permsSupervisor} onClose={() => setPermsSupervisor(null)} /> : null}
    </>
  );
}
