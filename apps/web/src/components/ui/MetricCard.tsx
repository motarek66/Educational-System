import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="metric-card">
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="metric-card__label">{label}</div>
          <div className="metric-card__value mt-2">{value}</div>
        </div>
        <div className="metric-card__icon"><Icon size={20} /></div>
      </div>
      {trend ? <div className="metric-card__trend">{trend}</div> : <span />}
    </Card>
  );
}
