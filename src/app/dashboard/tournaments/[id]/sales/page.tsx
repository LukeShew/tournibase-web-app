import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function TournamentSalesRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    notFound();
  }

  redirect(`/dashboard/tournaments/${tournamentId}/orders`);
}
