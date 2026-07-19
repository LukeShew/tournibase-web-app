import { formatCurrency, formatSalesDate } from "@/lib/dashboard-metrics";

type RevenueTrendCardProps = {
  days: Array<{
    date: string;
    totalRevenue: number;
  }>;
  totalRevenue: number;
};

export function RevenueTrendCard({
  days,
  totalRevenue,
}: RevenueTrendCardProps) {
  const maxRevenue = Math.max(
    1,
    ...days.map((day) => Number(day.totalRevenue)),
  );

  return (
    <section className="flex h-full flex-col rounded-[2rem] border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Revenue trend
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Sales by day
          </h2>
        </div>
        <div className="rounded-xl bg-brand-soft px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
            Total
          </p>
          <p className="font-mono text-lg font-semibold text-blue-700">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="mt-4 grid min-h-64 flex-1 place-items-center rounded-3xl bg-card-strong text-sm font-medium text-slate-500">
          No sales data yet
        </div>
      ) : (
        <div className="mt-4 flex min-h-72 flex-1 items-end gap-3 overflow-x-auto rounded-3xl bg-card-strong px-5 py-6">
          {days.map((day) => {
            const height = Math.max(
              8,
              Math.round((Number(day.totalRevenue) / maxRevenue) * 190),
            );

            return (
              <div
                key={day.date}
                className="flex min-w-20 flex-1 flex-col items-center justify-end gap-3"
              >
                <div className="flex h-48 items-end">
                  <div
                    className="w-8 rounded-full bg-blue-600 shadow-sm"
                    style={{ height }}
                    title={`${formatSalesDate(day.date)} · ${formatCurrency(
                      day.totalRevenue,
                    )}`}
                  />
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {formatCurrency(day.totalRevenue)}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                    {formatSalesDate(day.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
