export function FullPageLoader() {
  return (
    <div className="min-vh-100 d-grid" style={{ placeItems: 'center', background: 'var(--surface-page)' }}>
      <div className="text-center">
        <div className="spinner-border text-primary" role="status" aria-label="جار التحميل" />
        <p className="text-secondary mt-3">جار تجهيز النظام...</p>
      </div>
    </div>
  );
}
