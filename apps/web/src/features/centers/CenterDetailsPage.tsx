import { ArrowRight, Eye, MapPin, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PageSkeleton } from '../../components/feedback/PageSkeleton';
import { Card } from '../../components/ui/Card';
import { StatusBadge, studentStatusMeta } from '../../components/ui/StatusBadge';
import { api, getApiErrorMessage } from '../../lib/api/client';
import { formatNumber } from '../../lib/formatting';
import type { ApiResponse, CenterDetails } from '../../types/api';

export function CenterDetailsPage() {
  const { centerId = '' } = useParams();
  const query = useQuery({
    queryKey: ['center', centerId],
    queryFn: async () => (await api.get<ApiResponse<CenterDetails>>(`/centers/${centerId}`)).data.data,
    enabled: Boolean(centerId),
  });

  if (query.isLoading) return <PageSkeleton />;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const center = query.data;

  return (
    <>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2">
          <Link to="/centers" className="btn p-2"><ArrowRight size={20} /></Link>
          <div><h1 className="page-title">{center.name}</h1><p className="page-subtitle"><MapPin size={15} className="ms-1" />{center.address ?? 'لا يوجد عنوان مسجل'}</p></div>
        </div>
        <StatusBadge label={center.status === 'ACTIVE' ? 'نشط' : 'غير نشط'} tone={center.status === 'ACTIVE' ? 'success' : 'warning'} />
      </div>

      <Card className="panel mb-3 d-flex align-items-center justify-content-between">
        <div><div className="text-secondary small">طلاب السنتر</div><div className="fs-2 mt-2">{formatNumber(center.students.length)}</div></div>
        <div className="metric-card__icon"><Users size={22} /></div>
      </Card>

      <Card className="overflow-hidden">
        {center.students.length === 0 ? <div className="text-center text-secondary py-5">لا يوجد طلاب مسجلون في هذا السنتر.</div> : (
          <div className="table-responsive p-3">
            <table className="table align-middle">
              <thead><tr><th>الطالب</th><th>الكود</th><th>الصف</th><th>ولي الأمر</th><th>الحالة</th><th /></tr></thead>
              <tbody>{center.students.map((student) => <tr key={student.id}>
                <td className="fw-semibold">{student.fullName}</td>
                <td className="ltr-value">{student.studentCode}</td>
                <td>{student.gradeLevel}</td>
                <td className="ltr-value">{student.guardianPhone ?? '—'}</td>
                <td><StatusBadge {...studentStatusMeta[student.status]} /></td>
                <td><Link className="btn p-2" to={`/students/${student.id}`} aria-label={`عرض ${student.fullName}`}><Eye size={18} /></Link></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
