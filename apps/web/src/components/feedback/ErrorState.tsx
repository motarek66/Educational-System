import { AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="empty-state">
      <div>
        <div className="empty-state__icon" style={{ background: 'var(--color-danger-50)', color: 'var(--color-danger-500)' }}>
          <AlertTriangle size={26} />
        </div>
        <h2 className="h5">تعذر تحميل البيانات</h2>
        <p className="text-secondary mb-3">{message}</p>
        {onRetry ? <Button variant="secondary" onClick={onRetry}>إعادة المحاولة</Button> : null}
      </div>
    </Card>
  );
}
