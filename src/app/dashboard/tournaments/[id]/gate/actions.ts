"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDirector } from "@/lib/auth";
import type {
  RevokeScannerSessionState,
  ScannerSessionFormState,
} from "@/lib/form-states";
import {
  createScannerToken,
  hashScannerToken,
} from "@/lib/scanner-tokens";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const permissionSets = {
  full: ["scan", "lookup", "recent", "manual_sale"],
  scan_only: ["scan"],
  standard: ["scan", "lookup", "recent"],
} as const;

const scannerSessionSchema = z.object({
  expirationHours: z.enum(["4", "8", "12", "24", "72"], {
    message: "Choose how long this link should remain active.",
  }),
  gateName: z
    .string()
    .trim()
    .min(2, "Enter a gate or entrance name.")
    .max(80, "Keep the gate name under 80 characters."),
  permissionLevel: z.enum(["scan_only", "standard", "full"], {
    message: "Choose a permission level.",
  }),
  staffLabel: z
    .string()
    .trim()
    .min(2, "Enter a staff label.")
    .max(100, "Keep the staff label under 100 characters."),
});

type ScannerSessionField = keyof z.input<typeof scannerSessionSchema>;

type OwnedTournament = {
  id: number;
  status: "draft" | "published" | "closed" | "archived";
};

export async function createScannerSession(
  tournamentId: number,
  _previousState: ScannerSessionFormState,
  formData: FormData,
): Promise<ScannerSessionFormState> {
  void _previousState;
  const parsed = parseScannerSessionForm(formData);

  if (!parsed.success) {
    return parsed.state;
  }

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    return failureState("This event could not be found.");
  }

  const director = await requireDirector();
  const supabase = await createClient();
  const tournament = await getOwnedTournament(
    supabase,
    director.id,
    tournamentId,
  );

  if (!tournament) {
    return failureState("This event could not be found.");
  }

  if (tournament.status === "closed" || tournament.status === "archived") {
    return failureState(
      "Scanner links cannot be created for a closed or archived event.",
    );
  }

  const rawToken = createScannerToken();
  const tokenHash = hashScannerToken(rawToken);
  const expiresAt = new Date(
    Date.now() + Number(parsed.data.expirationHours) * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("scanner_sessions").insert({
    created_by: director.id,
    expires_at: expiresAt,
    gate_name: parsed.data.gateName,
    permissions: [...permissionSets[parsed.data.permissionLevel]],
    staff_label: parsed.data.staffLabel,
    token_hash: tokenHash,
    tournament_id: tournamentId,
  });

  if (error) {
    console.error("[scanner-session] creation failed", {
      code: error.code,
      message: error.message,
      tournamentId,
    });

    return failureState("We could not create this scanner link. Try again.");
  }

  revalidateScannerPaths(tournamentId);

  return {
    errors: {},
    message: "Scanner link created. Copy it now.",
    scannerUrl: `${getSiteUrl()}/scan/${rawToken}`,
    success: true,
    successId: crypto.randomUUID(),
  };
}

export async function revokeScannerSession(
  tournamentId: number,
  scannerSessionId: number,
  _previousState: RevokeScannerSessionState,
  _formData: FormData,
): Promise<RevokeScannerSessionState> {
  void _previousState;
  void _formData;

  if (
    !Number.isSafeInteger(tournamentId) ||
    tournamentId < 1 ||
    !Number.isSafeInteger(scannerSessionId) ||
    scannerSessionId < 1
  ) {
    return {
      message: "This scanner link could not be found.",
      success: false,
    };
  }

  const director = await requireDirector();
  const supabase = await createClient();
  const tournament = await getOwnedTournament(
    supabase,
    director.id,
    tournamentId,
  );

  if (!tournament) {
    return {
      message: "This event could not be found.",
      success: false,
    };
  }

  const { data: revokedSession, error } = await supabase
    .from("scanner_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", scannerSessionId)
    .eq("tournament_id", tournamentId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[scanner-session] revocation failed", {
      code: error.code,
      message: error.message,
      scannerSessionId,
      tournamentId,
    });
  }

  if (error || !revokedSession) {
    return {
      message: "This link is already inactive or could not be revoked.",
      success: false,
    };
  }

  revalidateScannerPaths(tournamentId);

  return {
    message: "Scanner link revoked.",
    success: true,
  };
}

function parseScannerSessionForm(formData: FormData):
  | {
      data: z.output<typeof scannerSessionSchema>;
      success: true;
    }
  | {
      state: ScannerSessionFormState;
      success: false;
    } {
  const result = scannerSessionSchema.safeParse({
    expirationHours: formData.get("expirationHours"),
    gateName: formData.get("gateName"),
    permissionLevel: formData.get("permissionLevel"),
    staffLabel: formData.get("staffLabel"),
  });

  if (result.success) {
    return {
      data: result.data,
      success: true,
    };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [ScannerSessionField, string[]] =>
        Boolean(entry[1]?.[0]),
      )
      .map(([field, messages]) => [field, messages[0]]),
  ) as Partial<Record<ScannerSessionField, string>>;

  return {
    state: {
      errors,
      message: "Check the highlighted fields and try again.",
      success: false,
    },
    success: false,
  };
}

async function getOwnedTournament(
  supabase: Awaited<ReturnType<typeof createClient>>,
  directorId: string,
  tournamentId: number,
): Promise<OwnedTournament | null> {
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", directorId);

  if (organizationError) {
    throw organizationError;
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    return null;
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, status")
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  return tournament as OwnedTournament | null;
}

function failureState(message: string): ScannerSessionFormState {
  return {
    errors: {},
    message,
    success: false,
  };
}

function revalidateScannerPaths(tournamentId: number) {
  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  revalidatePath(`/dashboard/tournaments/${tournamentId}/gate`);
}
