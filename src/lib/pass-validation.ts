import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { extractPassToken } from "@/lib/pass-tokens";
import {
  type OverridePassInput,
  type PassValidationResult,
  type UndoCheckInInput,
  type UndoCheckInResult,
  type ValidatePassInput,
} from "@/lib/pass-validation-types";
import {
  hashScannerToken,
  isValidScannerToken,
} from "@/lib/scanner-tokens";
import { getScannerSessionByToken } from "@/lib/scanner-sessions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const scanSourceSchema = z.enum(["camera", "manual"]);

const validatePassInputSchema = z.object({
  candidate: z.string().trim().min(1).max(2_048),
  source: scanSourceSchema,
});

const overridePassInputSchema = z.object({
  candidate: z.string().trim().min(1).max(2_048),
  passId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  source: scanSourceSchema,
});

const undoCheckInInputSchema = z.object({
  checkInId: z.number().int().positive(),
});

const passValidationResultSchema = z.discriminatedUnion("status", [
  z.object({
    admitCount: z.number().int().nonnegative(),
    checkInId: z.number().int().positive(),
    checkInTime: z.string(),
    gateName: z.string(),
    message: z.string(),
    passId: z.number().int().positive(),
    status: z.literal("valid"),
    ticketName: z.string(),
    tournamentName: z.string(),
    usesAllowed: z.number().int().positive(),
    wasManual: z.boolean(),
    wasOverride: z.boolean(),
  }),
  z.object({
    admitCount: z.number().int().nonnegative(),
    attemptId: z.number().int().positive(),
    firstGateName: z.string().nullable(),
    firstScannedAt: z.string().nullable(),
    message: z.string(),
    passId: z.number().int().positive(),
    status: z.literal("already_used"),
    ticketName: z.string(),
    usesAllowed: z.number().int().positive(),
  }),
  z.object({
    attemptId: z.number().int().positive(),
    message: z.string(),
    passId: z.number().int().positive(),
    status: z.literal("wrong_day"),
    ticketName: z.string(),
    validFrom: z.string(),
    validUntil: z.string(),
  }),
  z.object({
    attemptId: z.number().int().positive(),
    message: z.string(),
    status: z.literal("invalid"),
  }),
  z.object({
    attemptId: z.number().int().positive(),
    inactiveReason: z.enum(["expired", "refunded", "voided"]),
    message: z.string(),
    status: z.literal("not_active"),
    ticketName: z.string(),
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

const undoCheckInResultSchema = z.discriminatedUnion("status", [
  z.object({
    message: z.string(),
    passId: z.number().int().positive(),
    remainingAdmissions: z.number().int().nonnegative(),
    status: z.literal("undone"),
    ticketName: z.string(),
    tournamentName: z.string(),
    undoneAt: z.string(),
  }),
  z.object({
    message: z.string(),
    status: z.literal("already_undone"),
  }),
  z.object({
    message: z.string(),
    status: z.literal("not_found"),
  }),
  z.object({
    message: z.string(),
    status: z.literal("scanner_unauthorized"),
  }),
]);

const serviceError = {
  message: "TourniBase could not validate this pass. Try scanning it again.",
  status: "service_error",
} as const;

export async function validatePassForEntry(
  scannerToken: string,
  input: ValidatePassInput,
): Promise<PassValidationResult> {
  if (!isValidScannerToken(scannerToken)) {
    return scannerUnauthorized();
  }

  const allowed = await checkRateLimit({
    key: `scanner:${hashScannerToken(scannerToken)}`,
    limit: 240,
    windowSeconds: 60,
  });

  if (!allowed) {
    return {
      message: "This scanner is moving too quickly. Wait a moment and try again.",
      status: "service_error",
    };
  }

  const parsedInput = validatePassInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      message: "The scanned value could not be processed.",
      status: "invalid_request",
    };
  }

  const passToken = extractPassToken(parsedInput.data.candidate);
  const attemptedTokenHash = hashPassAttempt(
    passToken ?? parsedInput.data.candidate,
  );
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("validate_pass_for_entry", {
    p_attempted_token_hash: attemptedTokenHash,
    p_pass_token: passToken,
    p_scanner_token_hash: hashScannerToken(scannerToken),
    p_source: parsedInput.data.source,
  });

  if (error) {
    console.error("[pass-validation] validation RPC failed", {
      code: error.code,
      message: error.message,
    });

    return serviceError;
  }

  const parsedResult = passValidationResultSchema.safeParse(data);

  if (!parsedResult.success) {
    console.error("[pass-validation] unexpected validation response", {
      issues: parsedResult.error.issues.map((issue) => issue.message),
    });

    return serviceError;
  }

  return parsedResult.data;
}

export async function overrideDuplicatePassEntry(
  scannerToken: string,
  input: OverridePassInput,
): Promise<PassValidationResult> {
  if (!isValidScannerToken(scannerToken)) {
    return scannerUnauthorized();
  }

  const parsedInput = overridePassInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      message: "Enter a short reason before overriding this check-in.",
      status: "invalid_request",
    };
  }

  let scannerLookup: Awaited<
    ReturnType<typeof getScannerSessionByToken>
  >;

  try {
    scannerLookup = await getScannerSessionByToken(scannerToken);
  } catch (error) {
    console.error("[pass-validation] override authorization failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return serviceError;
  }

  if (
    scannerLookup.status !== "active" ||
    !scannerLookup.session.permissions.includes("lookup")
  ) {
    return scannerUnauthorized();
  }

  const passToken = extractPassToken(parsedInput.data.candidate);
  const attemptedTokenHash = hashPassAttempt(
    passToken ?? parsedInput.data.candidate,
  );
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc(
    "override_duplicate_pass_entry",
    {
      p_attempted_token_hash: attemptedTokenHash,
      p_pass_id: parsedInput.data.passId,
      p_reason: parsedInput.data.reason,
      p_scanner_token_hash: hashScannerToken(scannerToken),
      p_source: parsedInput.data.source,
    },
  );

  if (error) {
    console.error("[pass-validation] override RPC failed", {
      code: error.code,
      message: error.message,
    });

    return serviceError;
  }

  const parsedResult = passValidationResultSchema.safeParse(data);

  if (!parsedResult.success) {
    console.error("[pass-validation] unexpected override response", {
      issues: parsedResult.error.issues.map((issue) => issue.message),
    });

    return serviceError;
  }

  return parsedResult.data;
}

export async function undoPassCheckIn(
  scannerToken: string,
  input: UndoCheckInInput,
): Promise<UndoCheckInResult> {
  if (!isValidScannerToken(scannerToken)) {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  const parsedInput = undoCheckInInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      message: "This check-in could not be found.",
      status: "not_found",
    };
  }

  const supabase = getSupabaseAdmin();
  let scannerLookup: Awaited<
    ReturnType<typeof getScannerSessionByToken>
  >;

  try {
    scannerLookup = await getScannerSessionByToken(scannerToken);
  } catch (error) {
    console.error("[pass-validation] undo authorization failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      message: "TourniBase could not undo this check-in. Try again.",
      status: "service_error",
    };
  }

  if (scannerLookup.status !== "active") {
    return {
      message: "This scanner link is no longer authorized.",
      status: "scanner_unauthorized",
    };
  }

  const { data: checkInRow, error: checkInError } = await supabase
    .from("check_ins")
    .select("scanner_session_id")
    .eq("id", parsedInput.data.checkInId)
    .maybeSingle();

  if (
    checkInError ||
    !checkInRow ||
    checkInRow.scanner_session_id !== scannerLookup.session.id
  ) {
    return {
      message: "This check-in cannot be undone from this scanner.",
      status: "not_found",
    };
  }

  const { data, error } = await supabase.rpc("undo_pass_check_in", {
    p_check_in_id: parsedInput.data.checkInId,
    p_scanner_token_hash: hashScannerToken(scannerToken),
  });

  if (error) {
    console.error("[pass-validation] undo RPC failed", {
      code: error.code,
      message: error.message,
    });

    return {
      message: "TourniBase could not undo this check-in. Try again.",
      status: "service_error",
    };
  }

  const parsedResult = undoCheckInResultSchema.safeParse(data);

  if (!parsedResult.success) {
    console.error("[pass-validation] unexpected undo response", {
      issues: parsedResult.error.issues.map((issue) => issue.message),
    });

    return {
      message: "TourniBase could not undo this check-in. Try again.",
      status: "service_error",
    };
  }

  return parsedResult.data;
}

function hashPassAttempt(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function scannerUnauthorized(): PassValidationResult {
  return {
    message: "This scanner link is no longer authorized.",
    status: "scanner_unauthorized",
  };
}
