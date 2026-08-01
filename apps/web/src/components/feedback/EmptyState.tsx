import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="empty-state">
      <div>
        <div className="empty-state__icon"><Inbox size={26} /></div>
        <h2 className="h5">{title}</h2>
        <p className="text-secondary mb-3">{description}</p>
        {action}
      </div>
    </Card>
  );
}
