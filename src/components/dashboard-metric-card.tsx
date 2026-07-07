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
    <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-blue-700">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
