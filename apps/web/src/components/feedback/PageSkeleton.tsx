export function PageSkeleton() {
  return (
    <div className="d-grid gap-3">
      <div className="skeleton" style={{ height: 86 }} />
      <div className="metric-grid">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton" style={{ height: 132 }} />)}
      </div>
      <div className="skeleton" style={{ height: 360 }} />
    </div>
  );
}
