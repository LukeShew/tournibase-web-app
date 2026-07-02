export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-label="Loading dashboard">
      <div>
        <div className="h-4 w-28 rounded bg-white/10" />
        <div className="mt-3 h-9 w-72 rounded bg-white/10" />
        <div className="mt-3 h-5 w-96 max-w-full rounded bg-white/5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-28 rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-border bg-card" />
    </div>
  );
}
