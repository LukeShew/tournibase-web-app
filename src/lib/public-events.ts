import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();
    const { data: tournamentRow, error: tournamentError } = await supabase
      .from("tournaments")
      .select(
        "id, name, start_date, end_date, venue_name, venue_address, organizer_name, contact_email, description, public_slug, time_zone",
      )
      .eq("public_slug", eventSlug)
      .eq("status", "published")
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
      .order("price", { ascending: true })
      .order("created_at", { ascending: true });

    if (ticketError) {
      throw ticketError;
    }

    return {
      ...(tournamentRow as Omit<PublicEvent, "ticketTypes">),
      ticketTypes: (ticketRows ?? []) as PublicTicketType[],
    };
  },
);
