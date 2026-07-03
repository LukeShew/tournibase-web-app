import "server-only";

import { isValidPassToken } from "@/lib/pass-tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PublicPassStatus =
  | "active"
  | "checked_in"
  | "refunded"
  | "voided"
  | "expired";

type PassRecord = {
  id: number;
  order_id: number;
  public_token: string;
  status: PublicPassStatus;
  ticket_type_id: number;
  tournament_id: number;
  valid_from: string;
  valid_until: string;
};

type OrderRecord = {
  buyer_name: string;
  id: number;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partial_refund";
};

type TournamentRecord = {
  contact_email: string;
  name: string;
  organizer_name: string;
  venue_address: string;
  venue_name: string;
};

type TicketTypeRecord = {
  name: string;
};

export type PublicPass = {
  buyerName: string;
  contactEmail: string;
  eventName: string;
  id: number;
  orderNumber: string;
  organizerName: string;
  publicToken: string;
  status: PublicPassStatus;
  ticketName: string;
  validFrom: string;
  validUntil: string;
  venueAddress: string;
  venueName: string;
};

export async function getPublicPass(
  token: string,
): Promise<PublicPass | null> {
  if (!isValidPassToken(token)) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data: passRow, error: passError } = await supabase
    .from("passes")
    .select(
      "id, order_id, tournament_id, ticket_type_id, public_token, status, valid_from, valid_until",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (passError) {
    throw passError;
  }

  if (!passRow) {
    return null;
  }

  const pass = passRow as PassRecord;
  const [
    { data: orderRow, error: orderError },
    { data: tournamentRow, error: tournamentError },
    { data: ticketTypeRow, error: ticketTypeError },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, buyer_name, payment_status")
      .eq("id", pass.order_id)
      .maybeSingle(),
    supabase
      .from("tournaments")
      .select("name, venue_name, venue_address, organizer_name, contact_email")
      .eq("id", pass.tournament_id)
      .maybeSingle(),
    supabase
      .from("ticket_types")
      .select("name")
      .eq("id", pass.ticket_type_id)
      .maybeSingle(),
  ]);

  if (orderError) {
    throw orderError;
  }

  if (tournamentError) {
    throw tournamentError;
  }

  if (ticketTypeError) {
    throw ticketTypeError;
  }

  if (!orderRow || !tournamentRow || !ticketTypeRow) {
    return null;
  }

  const order = orderRow as OrderRecord;

  if (order.payment_status !== "paid") {
    return null;
  }

  const tournament = tournamentRow as TournamentRecord;
  const ticketType = ticketTypeRow as TicketTypeRecord;

  return {
    buyerName: order.buyer_name,
    contactEmail: tournament.contact_email,
    eventName: tournament.name,
    id: pass.id,
    orderNumber: `TB-${order.id.toString().padStart(6, "0")}`,
    organizerName: tournament.organizer_name,
    publicToken: pass.public_token,
    status: pass.status,
    ticketName: ticketType.name,
    validFrom: pass.valid_from,
    validUntil: pass.valid_until,
    venueAddress: tournament.venue_address,
    venueName: tournament.venue_name,
  };
}
