"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth";
import type { PublicationState } from "@/lib/form-states";
import { isOrganizationStripeAccountReady } from "@/lib/stripe-connect";
import { getStripeConfigurationIssues } from "@/lib/stripe";
import {
  getSupabaseAdmin,
  getSupabaseAdminConfigurationIssues,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function setTournamentPublication(
  tournamentId: number,
  nextStatus: "draft" | "published",
  _previousState: PublicationState,
  _formData: FormData,
): Promise<PublicationState> {
  void _previousState;
  void _formData;
  const director = await requireDirector();
  const supabase = await createClient();
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", director.id);

  if (organizationError) {
    return {
      message: "We could not verify this event. Try again.",
      success: false,
    };
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    return {
      message: "You do not have access to this event.",
      success: false,
    };
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, organization_id, public_slug, status")
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (tournamentError || !tournament) {
    return {
      message: "This event could not be found.",
      success: false,
    };
  }

  if (tournament.status === "closed" || tournament.status === "archived") {
    return {
      message: "Closed or archived events cannot be published.",
      success: false,
    };
  }

  if (nextStatus === "published") {
    const { data: activeTickets, error: ticketError } = await supabase
      .from("ticket_types")
      .select("id, price")
      .eq("tournament_id", tournamentId)
      .eq("status", "active");

    if (ticketError) {
      return {
        message: "We could not verify the active tickets. Try again.",
        success: false,
      };
    }

    if (!activeTickets?.length) {
      return {
        message: "Add at least one active ticket before publishing.",
        success: false,
      };
    }

    const hasPaidTickets = activeTickets.some(
      (ticket) => Number(ticket.price) > 0,
    );

    if (
      hasPaidTickets &&
      !(await isOrganizationStripeAccountReady(
        tournament.organization_id as number,
      ))
    ) {
      return {
        message:
          "Connect a ready Stripe account in Settings before publishing paid tickets.",
        success: false,
      };
    }

    if (
      hasPaidTickets &&
      (getStripeConfigurationIssues({
        includeConnectedPaymentsWebhookSecret: true,
        includePublishableKey: true,
      }).length > 0 ||
        getSupabaseAdminConfigurationIssues().length > 0)
    ) {
      return {
        message:
          "Paid checkout setup is incomplete. Finish the Stripe and server configuration before publishing.",
        success: false,
      };
    }
  }

  const { data: updatedTournament, error: updateError } =
    await getSupabaseAdmin()
    .from("tournaments")
    .update({ status: nextStatus })
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedTournament) {
    return {
      message: "We could not update the public ticket page. Try again.",
      success: false,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  revalidatePath(`/dashboard/tournaments/${tournamentId}/tickets`);
  revalidatePath(`/e/${tournament.public_slug}`);

  return {
    message:
      nextStatus === "published"
        ? "Public ticket page published."
        : "Public ticket page returned to draft.",
    success: true,
  };
}
