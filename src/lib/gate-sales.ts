import "server-only";

import { z } from "zod";
import type {
  GateSaleTicketOption,
  RecordGateSaleInput,
  RecordGateSaleResult,
} from "@/lib/gate-sales-types";
import {
  hashScannerToken,
  isValidScannerToken,
} from "@/lib/scanner-tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const recordGateSaleInputSchema = z.object({
  buyerName: z.string().trim().max(160),
  notes: z.string().trim().max(500),
  paymentMethod: z.enum([
    "cash",
    "venmo",
    "card_outside_tournibase",
    "comp",
  ]),
  quantity: z.number().int().min(1).max(100),
  ticketTypeId: z.number().int().positive(),
});

const recordGateSaleResultSchema = z.discriminatedUnion("status", [
  z.object({
    amount: z.number().nonnegative(),
    buyerName: z.string().nullable(),
    gateName: z.string(),
    message: z.string(),
    paymentMethod: z.enum([
      "cash",
      "venmo",
      "card_outside_tournibase",
      "comp",
    ]),
    quantity: z.number().int().positive(),
    recordedAt: z.string(),
    saleId: z.number().int().positive(),
    status: z.literal("recorded"),
    ticketName: z.string(),
    tournamentName: z.string(),
  }),
  z.object({
    message: z.string(),
    status: z.literal("invalid_request"),
  }),
  z.object({
    message: z.string(),
    status: z.literal("scanner_unauthorized"),
  }),
]);

const serviceError = {
  message: "TourniBase could not record this gate sale. Try again.",
  status: "service_error",
} as const;

export async function getGateSaleTicketOptions(
  tournamentId: number,
): Promise<GateSaleTicketOption[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ticket_types")
    .select("id, name, price, valid_from, valid_until")
    .eq("tournament_id", tournamentId)
    .eq("status", "active")
    .order("price", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((ticket) => ({
    id: ticket.id as number,
    name: ticket.name as string,
    price: Number(ticket.price),
    validFrom: ticket.valid_from as string,
    validUntil: ticket.valid_until as string,
  }));
}

export async function recordGateSale(
  scannerToken: string,
  input: RecordGateSaleInput,
): Promise<RecordGateSaleResult> {
  if (!isValidScannerToken(scannerToken)) {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  const parsedInput = recordGateSaleInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      message: "Check the sale details and try again.",
      status: "invalid_request",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("record_gate_sale", {
      p_buyer_name: parsedInput.data.buyerName || null,
      p_notes: parsedInput.data.notes || null,
      p_payment_method: parsedInput.data.paymentMethod,
      p_quantity: parsedInput.data.quantity,
      p_scanner_token_hash: hashScannerToken(scannerToken),
      p_ticket_type_id: parsedInput.data.ticketTypeId,
    });

    if (error) {
      console.error("[gate-sale] record RPC failed", {
        code: error.code,
        message: error.message,
      });

      return serviceError;
    }

    const parsedResult = recordGateSaleResultSchema.safeParse(data);

    if (!parsedResult.success) {
      console.error("[gate-sale] unexpected record response", {
        issues: parsedResult.error.issues.map((issue) => issue.message),
      });

      return serviceError;
    }

    return parsedResult.data;
  } catch (error) {
    console.error("[gate-sale] record failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return serviceError;
  }
}
