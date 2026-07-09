import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import {
  OrderLogClient,
  type OrderLogOrder,
} from "@/components/order-log-client";
import { RevenueTrendCard } from "@/components/revenue-trend-card";
import { requireDirector } from "@/lib/auth";
import {
  formatCurrency,
  getTournamentDashboardMetrics,
} from "@/lib/dashboard-metrics";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Orders",
};

type TournamentRecord = {
  end_date: string;
  id: number;
  name: string;
  start_date: string;
};

export default async function EventOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ q?: string }>({}),
  ]);
  const tournamentId = Number(id);

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    notFound();
  }

  const director = await requireDirector();
  const supabase = await createClient();

  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", director.id);

  if (organizationError) {
    throw organizationError;
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    notFound();
  }

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, start_date, end_date")
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  if (!tournamentRow) {
    notFound();
  }

  const metrics = await getTournamentDashboardMetrics(tournamentId);

  if (!metrics) {
    notFound();
  }

  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, buyer_name, buyer_email, buyer_phone, amount_total, payment_status, created_at, stripe_checkout_id, order_items(id, ticket_name, unit_amount_cents, quantity, valid_from, valid_until), passes(id, public_token, status, sequence_number, ticket_types(name))",
    )
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (orderError) {
    throw orderError;
  }

  const query = (resolvedSearchParams.q ?? "").trim();
  const queryLower = query.toLowerCase();
  const allOrders = ((orderRows ?? []) as unknown as OrderLogOrder[]).map(
    (order) => ({
      ...order,
      order_items: order.order_items ?? [],
      passes: order.passes ?? [],
    }),
  );
  const orders = allOrders.filter((order) => {
    if (!queryLower) {
      return true;
    }

    const orderNumber = getOrderNumber(order.id).toLowerCase();

    return [
      orderNumber,
      order.buyer_name,
      order.buyer_email,
      order.buyer_phone ?? "",
    ].some((value) => value.toLowerCase().includes(queryLower));
  });
  const tournament = tournamentRow as TournamentRecord;

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to event
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            {tournament.name}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Orders
          </h1>
          <p className="mt-3 font-mono text-sm text-slate-400">
            {formatEventDateRange(tournament.start_date, tournament.end_date)}
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:items-stretch">
        <RevenueTrendCard
          days={metrics.salesByDay}
          totalRevenue={metrics.sales.totalEstimatedRevenue}
        />

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Sales breakdown
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Revenue and admissions
            </h2>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
      </section>

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-card-strong px-6 py-5">
          <h2 className="font-semibold text-slate-950">Order log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Search recent orders by buyer name, email, phone, or order number.
          </p>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              className="min-h-11 flex-1 rounded-2xl border border-border bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              defaultValue={query}
              name="q"
              placeholder="Search orders"
              type="search"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              Search
            </button>
          </form>
        </div>

        <OrderLogClient orders={orders} tournamentId={tournamentId} />
      </section>
    </div>
  );
}

function getOrderNumber(orderId: number) {
  return `TB-${orderId.toString().padStart(6, "0")}`;
}
