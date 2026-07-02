"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth";
import type { PublicationState } from "@/lib/form-states";
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
    .select("id, public_slug, status")
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
    const { count, error: ticketError } = await supabase
      .from("ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("status", "active");

    if (ticketError) {
      return {
        message: "We could not verify the active tickets. Try again.",
        success: false,
      };
    }

    if (!count) {
      return {
        message: "Add at least one active ticket before publishing.",
        success: false,
      };
    }
  }

  const { data: updatedTournament, error: updateError } = await supabase
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
