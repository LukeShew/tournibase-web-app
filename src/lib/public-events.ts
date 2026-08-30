import { cache } from "react";
import { getAppEnvironment } from "@/lib/app-environment";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PublicTicketType = {
  description: string | null;
  id: number;
  name: string;
  price: number | string;
  quantity_limit: number | null;
  valid_from: string;
  valid_until: string;
};

export type PublicEvent = {
  contact_email: string;
  description: string | null;
  end_date: string;
  id: number;
  name: string;
  organization_id: number;
  organizer_name: string;
  public_slug: string;
  start_date: string;
  ticketTypes: PublicTicketType[];
  time_zone: string;
  venue_address: string | null;
  venue_name: string;
};

export const getPublicEvent = cache(
  async (eventSlug: string): Promise<PublicEvent | null> => {
    const supabase = getSupabaseAdmin();
    const { data: tournamentRow, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, organization_id, name, start_date, end_date, venue_name, venue_address, organizer_name, contact_email, description, public_slug, time_zone, organizations!inner(operating_environment)",
      )
      .eq("public_slug", eventSlug)
      .eq("status", "published")
      .eq("organizations.operating_environment", getAppEnvironment())
      .maybeSingle();

    if (tournamentError) {
      throw tournamentError;
    }

    if (!tournamentRow) {
      return null;
    }

    const { data: ticketRows, error: ticketError } = await supabase
      .from("ticket_types")
      .select(
        "id, name, price, valid_from, valid_until, description, quantity_limit",
      )
      .eq("tournament_id", tournamentRow.id)
      .eq("status", "active")
      .gte("valid_until", new Date().toISOString())
      .order("price", { ascending: true })
      .order("created_at", { ascending: true });

    if (ticketError) {
      throw ticketError;
    }

    return {
      id: tournamentRow.id as number,
      organization_id: tournamentRow.organization_id as number,
      name: tournamentRow.name as string,
      start_date: tournamentRow.start_date as string,
      end_date: tournamentRow.end_date as string,
      venue_name: tournamentRow.venue_name as string,
      venue_address: tournamentRow.venue_address as string | null,
      organizer_name: tournamentRow.organizer_name as string,
      contact_email: tournamentRow.contact_email as string,
      description: tournamentRow.description as string | null,
      public_slug: tournamentRow.public_slug as string,
      time_zone: tournamentRow.time_zone as string,
      ticketTypes: (ticketRows ?? []) as PublicTicketType[],
    };
  },
);
