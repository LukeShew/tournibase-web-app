type DashboardMetricCardProps = {
  detail: string;
  label: string;
  value: string | number;
};

export function DashboardMetricCard({
  detail,
  label,
  value,
}: DashboardMetricCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
