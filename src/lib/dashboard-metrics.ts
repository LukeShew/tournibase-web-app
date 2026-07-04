import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const moneySchema = z.number().finite().nonnegative();

const dashboardMetricsSchema = z.object({
  gate: z.object({
    checkedInPasses: z.number().int().nonnegative(),
    duplicateAttempts: z.number().int().nonnegative(),
    invalidAttempts: z.number().int().nonnegative(),
    manualCheckIns: z.number().int().nonnegative(),
    overrides: z.number().int().nonnegative(),
    successfulCheckIns: z.number().int().nonnegative(),
    totalScanAttempts: z.number().int().nonnegative(),
    unscannedPasses: z.number().int().nonnegative(),
    wrongDayAttempts: z.number().int().nonnegative(),
  }),
  sales: z.object({
    estimatedNetPayout: moneySchema,
    estimatedStripeFees: moneySchema,
    grossOnlineSales: moneySchema,
    manualAdmissions: z.number().int().nonnegative(),
    manualSaleCount: z.number().int().nonnegative(),
    manualSales: moneySchema,
    onlineOrderCount: z.number().int().nonnegative(),
    onlineTicketsSold: z.number().int().nonnegative(),
    totalEstimatedRevenue: moneySchema,
  }),
  salesByDay: z.array(
    z.object({
      date: z.string(),
      manualAdmissions: z.number().int().nonnegative(),
      manualRevenue: moneySchema,
      onlineRevenue: moneySchema,
      onlineTickets: z.number().int().nonnegative(),
      totalAdmissions: z.number().int().nonnegative(),
      totalRevenue: moneySchema,
    }),
  ),
  salesByTicketType: z.array(
    z.object({
      manualAdmissions: z.number().int().nonnegative(),
      manualRevenue: moneySchema,
      onlineRevenue: moneySchema,
      onlineTickets: z.number().int().nonnegative(),
      ticketName: z.string(),
      ticketTypeId: z.number().int().positive(),
      totalAdmissions: z.number().int().nonnegative(),
      totalRevenue: moneySchema,
    }),
  ),
  scannerLinks: z.object({
    active: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  tournament: z.object({
    endDate: z.string(),
    id: z.number().int().positive(),
    name: z.string(),
    publicSlug: z.string(),
    startDate: z.string(),
    status: z.enum(["archived", "closed", "draft", "published"]),
    timeZone: z.string(),
    venueName: z.string(),
  }),
});

export type TournamentDashboardMetrics = z.infer<
  typeof dashboardMetricsSchema
>;

export async function getTournamentDashboardMetrics(
  tournamentId: number,
): Promise<TournamentDashboardMetrics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_tournament_dashboard_metrics",
    {
      p_tournament_id: tournamentId,
    },
  );

  if (error) {
    throw error;
  }

  if (data === null) {
    return null;
  }

  const result = dashboardMetricsSchema.safeParse(data);

  if (!result.success) {
    console.error("[dashboard-metrics] unexpected database response", {
      issues: result.error.issues.map((issue) => issue.message),
      tournamentId,
    });
    throw new Error("Tournament metrics could not be loaded.");
  }

  return result.data;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

export function formatSalesDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
