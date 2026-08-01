import clsx from 'clsx';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <span className={clsx('badge-soft', `badge-soft--${tone}`)}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export const studentStatusMeta = {
  ACTIVE: { label: 'نشط', tone: 'success' as const },
  INACTIVE: { label: 'غير نشط', tone: 'warning' as const },
  WITHDRAWN: { label: 'منسحب', tone: 'neutral' as const },
  SUSPENDED: { label: 'موقوف', tone: 'danger' as const },
};

export const lessonStatusMeta = {
  DRAFT: { label: 'مسودة', tone: 'neutral' as const },
  OPEN: { label: 'مفتوحة', tone: 'success' as const },
  CLOSED: { label: 'مغلقة', tone: 'primary' as const },
  CANCELLED: { label: 'ملغاة', tone: 'danger' as const },
};

export const examStatusMeta = {
  DRAFT: { label: 'مسودة', tone: 'neutral' as const },
  OPEN_FOR_GRADING: { label: 'إدخال الدرجات', tone: 'info' as const },
  PUBLISHED: { label: 'منشور', tone: 'success' as const },
  LOCKED: { label: 'مقفل', tone: 'primary' as const },
  CANCELLED: { label: 'ملغي', tone: 'danger' as const },
};
