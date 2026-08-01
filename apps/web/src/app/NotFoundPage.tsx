import { Home, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

export function NotFoundPage() {
  return (
    <Card className="empty-state mt-4">
      <div>
        <div className="empty-state__icon"><SearchX size={28} /></div>
        <h1 className="h4">الصفحة غير موجودة</h1>
        <p className="text-secondary">قد يكون الرابط غير صحيح أو تم نقل الصفحة.</p>
        <Link className="app-button app-button--primary" to="/"><Home size={18} /> العودة للرئيسية</Link>
      </div>
    </Card>
  );
}
