import "server-only";

import { z } from "zod";
import type { RecentScansResult } from "@/lib/recent-scans-types";
import {
  hashScannerToken,
  isValidScannerToken,
} from "@/lib/scanner-tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const recentScanSchema = z.object({
  buyerName: z.string().nullable(),
  checkInId: z.number().int().positive(),
  gateName: z.string(),
  overrideReason: z.string().nullable(),
  result: z.enum([
    "already_used",
    "invalid",
    "manual_check_in",
    "override",
    "refunded",
    "valid",
    "voided",
    "wrong_day",
  ]),
  scannedAt: z.string(),
  source: z.enum(["camera", "manual"]),
  ticketName: z.string().nullable(),
  wasOverride: z.boolean(),
  wasUndone: z.boolean(),
});

const recentScansResultSchema = z.discriminatedUnion("status", [
  z.object({
    scans: z.array(recentScanSchema),
    status: z.literal("ok"),
    timeZone: z.string(),
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
  message: "TourniBase could not load recent scans. Try again.",
  status: "service_error",
} as const;

export async function getRecentScannerActivity(
  scannerToken: string,
): Promise<RecentScansResult> {
  if (!isValidScannerToken(scannerToken)) {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("get_recent_scans", {
      p_limit: 50,
      p_scanner_token_hash: hashScannerToken(scannerToken),
    });

    if (error) {
      console.error("[recent-scans] lookup RPC failed", {
        code: error.code,
        message: error.message,
      });

      return serviceError;
    }

    const parsedResult = recentScansResultSchema.safeParse(data);

    if (!parsedResult.success) {
      console.error("[recent-scans] unexpected lookup response", {
        issues: parsedResult.error.issues.map((issue) => issue.message),
      });

      return serviceError;
    }

    return parsedResult.data;
  } catch (error) {
    console.error("[recent-scans] lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return serviceError;
  }
}
