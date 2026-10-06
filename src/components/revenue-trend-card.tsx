import { formatCurrency, formatSalesDate } from "@/lib/dashboard-metrics";
import { selectSalesByDay } from "@/lib/sales-by-day";

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
  const displayedDays = selectSalesByDay(days);
  const maxRevenue = Math.max(
    1,
    ...displayedDays.map((day) => Number(day.totalRevenue)),
  );

  return (
    <section className="revenue-trend-card relative flex h-full min-w-0 flex-col rounded-[2rem] border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="pr-28">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
          Revenue trend
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">
          Sales by day
        </h2>
      </div>
      <div className="absolute right-6 top-6 rounded-xl bg-brand-soft px-3 py-2 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
          Total
        </p>
        <p className="font-mono text-lg font-semibold text-blue-700">
          {formatCurrency(totalRevenue)}
        </p>
      </div>

      {displayedDays.length === 0 ? (
        <div className="mt-4 grid min-h-64 flex-1 place-items-center rounded-3xl bg-card-strong text-sm font-medium text-slate-500">
          No sales data yet
        </div>
      ) : (
        <div className="revenue-trend-plot mt-4 grid min-h-72 flex-1 items-end gap-2 rounded-3xl bg-card-strong px-3 py-6" style={{ gridTemplateColumns: `repeat(${displayedDays.length}, minmax(0, 1fr))` }}>
          {displayedDays.map((day) => {
            const height = Math.max(
              8,
              Math.round((Number(day.totalRevenue) / maxRevenue) * 190),
            );

            return (
              <div
                key={day.date}
                className="revenue-trend-day flex min-w-0 flex-col items-center justify-end gap-3"
              >
                <div className="revenue-trend-track flex h-48 w-full items-end justify-center">
                  <div
                    className="revenue-trend-bar w-8 max-w-full rounded-full bg-blue-600 shadow-sm"
                    style={{ height }}
                    title={`${formatSalesDate(day.date)} · ${formatCurrency(
                      day.totalRevenue,
                    )}`}
                  />
                </div>
                <div className="revenue-trend-label min-w-0 text-center">
                  <p className="revenue-trend-full break-words font-mono text-xs font-semibold text-slate-700">
                    {formatCurrency(day.totalRevenue)}
                  </p>
                  <p className="revenue-trend-compact font-mono text-xs font-semibold text-slate-700" title={formatCurrency(day.totalRevenue)}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 }).format(day.totalRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="revenue-trend-full">{formatSalesDate(day.date)}</span>
                    <span className="revenue-trend-compact" title={formatSalesDate(day.date)}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day.date}T12:00:00Z`))}</span>
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
