import { useEffect, useRef } from 'react';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="border-0 rounded-4 p-0" onCancel={onClose}>
      <div className="app-card p-4" style={{ width: 'min(92vw, 460px)' }}>
        <h2 className="h5 mb-2">{title}</h2>
        <p className="text-secondary mb-4">{message}</p>
        <div className="d-flex gap-2 justify-content-end">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
