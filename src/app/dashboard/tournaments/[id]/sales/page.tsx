import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { TournamentDashboardNav } from "@/components/tournament-dashboard-nav";
import { requireDirector } from "@/lib/auth";
import {
  formatCurrency,
  formatSalesDate,
  getTournamentDashboardMetrics,
} from "@/lib/dashboard-metrics";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Sales dashboard",
};

export default async function TournamentSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    notFound();
  }

  await requireDirector();
  const metrics = await getTournamentDashboardMetrics(tournamentId);

  if (!metrics) {
    notFound();
  }

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span>
        Back to event
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-blue-300">
            {metrics.tournament.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            Sales dashboard
          </h1>
          <p className="mt-3 font-mono text-sm text-slate-400">
            {formatEventDateRange(
              metrics.tournament.startDate,
              metrics.tournament.endDate,
            )}
          </p>
        </div>
        <Link
          href={`/dashboard/tournaments/${tournamentId}/gate`}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
        >
          Gate tools
        </Link>
      </div>

      <TournamentDashboardNav active="sales" tournamentId={tournamentId} />

      <section className="mt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-blue-300">
            Sales breakdown
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Revenue and admissions
          </h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            detail={`${metrics.sales.onlineOrderCount} captured online orders`}
            label="Gross online sales"
            value={formatCurrency(metrics.sales.grossOnlineSales)}
          />
          <DashboardMetricCard
            detail={`After ${formatCurrency(metrics.sales.estimatedStripeFees)} in estimated processing fees`}
            label="Estimated net payout"
            value={formatCurrency(metrics.sales.estimatedNetPayout)}
          />
          <DashboardMetricCard
            detail="Paid online admission passes"
            label="Online tickets sold"
            value={metrics.sales.onlineTicketsSold}
          />
          <DashboardMetricCard
            detail="Online and recorded gate revenue"
            label="Estimated total revenue"
            value={formatCurrency(metrics.sales.totalEstimatedRevenue)}
          />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Manual gate sales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Payments recorded by full-access gate staff outside TourniBase
            checkout.
          </p>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          <SummaryItem
            label="Recorded sales"
            value={metrics.sales.manualSaleCount}
          />
          <SummaryItem
            label="Admissions"
            value={metrics.sales.manualAdmissions}
          />
          <SummaryItem
            label="Revenue"
            value={formatCurrency(metrics.sales.manualSales)}
          />
        </dl>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Sales by ticket type</h2>
          <p className="mt-1 text-sm text-slate-500">
            Online checkout and recorded gate sales shown together.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Ticket</th>
                <th className="px-5 py-3 text-right font-medium">Online</th>
                <th className="px-5 py-3 text-right font-medium">Gate</th>
                <th className="px-5 py-3 text-right font-medium">
                  Admissions
                </th>
                <th className="px-5 py-3 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics.salesByTicketType.length === 0 ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-slate-500"
                    colSpan={5}
                  >
                    No ticket types have been created for this event.
                  </td>
                </tr>
              ) : (
                metrics.salesByTicketType.map((ticket) => (
                  <tr key={ticket.ticketTypeId}>
                    <td className="px-5 py-4 font-medium text-slate-100">
                      {ticket.ticketName}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-300">
                      {ticket.onlineTickets}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-300">
                      {ticket.manualAdmissions}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-white">
                      {ticket.totalAdmissions}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-white">
                      {formatCurrency(ticket.totalRevenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Sales by day</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sale dates use the tournament time zone.
          </p>
        </div>
        {metrics.salesByDay.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No paid or recorded gate sales yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">
                    Online tickets
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    Gate admissions
                  </th>
                  <th className="px-5 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.salesByDay.map((day) => (
                  <tr key={day.date}>
                    <td className="px-5 py-4 text-slate-200">
                      {formatSalesDate(day.date)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-300">
                      {day.onlineTickets}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-300">
                      {day.manualAdmissions}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-white">
                      {formatCurrency(day.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-5 text-xs leading-5 text-slate-600">
        Estimated Stripe fees use 2.9% plus 30¢ per captured online order.
        Actual fees, disputes, and partial refunds can change the final payout.
      </p>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-card px-5 py-5">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-2xl font-semibold text-white">
        {value}
      </dd>
    </div>
  );
}
