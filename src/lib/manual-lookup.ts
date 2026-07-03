import "server-only";

import { z } from "zod";
import type {
  ManualLookupCheckInInput,
  ManualLookupCheckInResult,
  ManualLookupResult,
} from "@/lib/manual-lookup-types";
import { validatePassForEntry } from "@/lib/pass-validation";
import {
  hashScannerToken,
  isValidScannerToken,
} from "@/lib/scanner-tokens";
import { getScannerSessionByToken } from "@/lib/scanner-sessions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const lookupQuerySchema = z.string().trim().min(2).max(100);
const checkInInputSchema = z.object({
  passId: z.number().int().positive(),
});

const manualLookupPassSchema = z.object({
  admissionsUsed: z.number().int().nonnegative(),
  canCheckIn: z.boolean(),
  passId: z.number().int().positive(),
  status: z.enum([
    "active",
    "checked_in",
    "expired",
    "refunded",
    "voided",
  ]),
  ticketName: z.string(),
  usesAllowed: z.number().int().positive(),
  validFrom: z.string(),
  validUntil: z.string(),
});

const manualLookupOrderSchema = z.object({
  buyerEmail: z.string(),
  buyerName: z.string(),
  buyerPhone: z.string().nullable(),
  createdAt: z.string(),
  orderId: z.number().int().positive(),
  orderNumber: z.string(),
  passes: z.array(manualLookupPassSchema),
  paymentStatus: z.enum([
    "failed",
    "paid",
    "partial_refund",
    "pending",
    "refunded",
  ]),
  scannedPasses: z.number().int().nonnegative(),
  unusedPasses: z.number().int().nonnegative(),
});

const manualLookupResultSchema = z.discriminatedUnion("status", [
  z.object({
    orders: z.array(manualLookupOrderSchema),
    status: z.literal("ok"),
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

const lookupServiceError = {
  message: "TourniBase could not search orders. Try again.",
  status: "service_error",
} as const;

const checkInServiceError = {
  message: "TourniBase could not check in this pass. Try again.",
  status: "service_error",
} as const;

export async function lookupManualGateOrders(
  scannerToken: string,
  query: string,
): Promise<ManualLookupResult> {
  if (!isValidScannerToken(scannerToken)) {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  const parsedQuery = lookupQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return {
      message: "Enter at least 2 characters and no more than 100.",
      status: "invalid_request",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("lookup_gate_orders", {
      p_query: parsedQuery.data,
      p_scanner_token_hash: hashScannerToken(scannerToken),
    });

    if (error) {
      console.error("[manual-lookup] lookup RPC failed", {
        code: error.code,
        message: error.message,
      });

      return lookupServiceError;
    }

    const parsedResult = manualLookupResultSchema.safeParse(data);

    if (!parsedResult.success) {
      console.error("[manual-lookup] unexpected lookup response", {
        issues: parsedResult.error.issues.map((issue) => issue.message),
      });

      return lookupServiceError;
    }

    return parsedResult.data;
  } catch (error) {
    console.error("[manual-lookup] lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return lookupServiceError;
  }
}

export async function checkInManualLookupPass(
  scannerToken: string,
  input: ManualLookupCheckInInput,
): Promise<ManualLookupCheckInResult> {
  if (!isValidScannerToken(scannerToken)) {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  const parsedInput = checkInInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      message: "This pass could not be checked in.",
      status: "invalid_request",
    };
  }

  try {
    const scannerLookup = await getScannerSessionByToken(scannerToken);

    if (
      scannerLookup.status !== "active" ||
      !scannerLookup.session.permissions.includes("lookup") ||
      !scannerLookup.session.permissions.includes("scan")
    ) {
      return {
        message: "This scanner link is not authorized for manual check-in.",
        status: "scanner_unauthorized",
      };
    }

    const supabase = getSupabaseAdmin();
    const { data: passRow, error } = await supabase
      .from("passes")
      .select("public_token")
      .eq("id", parsedInput.data.passId)
      .eq("tournament_id", scannerLookup.session.tournamentId)
      .maybeSingle();

    if (error) {
      console.error("[manual-lookup] pass lookup failed", {
        code: error.code,
        message: error.message,
      });

      return checkInServiceError;
    }

    if (!passRow || typeof passRow.public_token !== "string") {
      return {
        message: "This pass is not available for this tournament.",
        status: "invalid_request",
      };
    }

    return validatePassForEntry(scannerToken, {
      candidate: passRow.public_token,
      source: "manual",
    });
  } catch (error) {
    console.error("[manual-lookup] manual check-in failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return checkInServiceError;
  }
}
