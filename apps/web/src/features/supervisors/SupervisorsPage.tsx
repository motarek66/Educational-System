import { useQuery } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import type { ApiResponse } from '../../types/api';

type Supervisor = {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  roles: string[];
  centers: string[];
};

export function SupervisorsPage() {
  const query = useQuery({
    queryKey: ['users', 'supervisors'],
    queryFn: async () => (await api.get<ApiResponse<Supervisor[]>>('/users', { params: { type: 'supervisor' } })).data.data,
  });

  return (
    <>
      <PageHeader title="المشرفون والصلاحيات" subtitle="أضف المشرفين وحدد أدوارهم والسناتر المسموح بها." actions={<Button><Plus size={18} /> إضافة مشرف</Button>} />
      <div className="row g-3 mb-3"><div className="col-md-6"><Card className="panel d-flex align-items-center justify-content-between"><div><div className="text-secondary small">المستخدمون النشطون</div><div className="fs-2 mt-2">{query.data?.filter((item) => item.status === 'ACTIVE').length ?? 0}</div></div><div className="metric-card__icon"><UserCog size={21} /></div></Card></div><div className="col-md-6"><Card className="panel d-flex align-items-center justify-content-between"><div><div className="text-secondary small">الأدوار المخصصة</div><div className="fs-2 mt-2">{new Set(query.data?.flatMap((item) => item.roles) ?? []).size}</div></div><div className="metric-card__icon"><ShieldCheck size={21} /></div></Card></div></div>
      {query.isError ? <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? <Card className="skeleton" style={{ height: 400 }} /> : null}
      {!query.isLoading && !query.isError && query.data?.length === 0 ? <EmptyState title="لا يوجد مشرفون" description="أضف مشرفًا وحدد الدور والنطاق قبل إرسال بيانات الدخول." action={<Button><Plus size={18} /> إضافة مشرف</Button>} /> : null}
      {query.data && query.data.length > 0 ? <Card className="overflow-hidden"><div className="table-responsive p-3"><table className="table"><thead><tr><th>المستخدم</th><th>الدور</th><th>النطاق</th><th>الحالة</th><th /></tr></thead><tbody>{query.data.map((user) => <tr key={user.id}><td><div className="fw-semibold">{user.fullName}</div><div className="text-secondary small ltr-value">{user.email ?? user.phoneE164}</div></td><td>{user.roles.join('، ') || 'بدون دور'}</td><td>{user.centers.join('، ') || 'كل السناتر'}</td><td><StatusBadge label={user.status === 'ACTIVE' ? 'نشط' : user.status === 'INVITED' ? 'دعوة معلقة' : 'موقوف'} tone={user.status === 'ACTIVE' ? 'success' : user.status === 'INVITED' ? 'info' : 'danger'} /></td><td><Button variant="ghost"><KeyRound size={17} /> إدارة الصلاحيات</Button></td></tr>)}</tbody></table></div></Card> : null}
    </>
  );
}
