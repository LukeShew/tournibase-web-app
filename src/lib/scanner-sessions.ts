import "server-only";

import {
  hashScannerToken,
  isValidScannerToken,
} from "@/lib/scanner-tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ScannerSessionRecord = {
  expires_at: string;
  gate_name: string;
  id: number;
  permissions: string[];
  revoked_at: string | null;
  staff_label: string;
  tournament_id: number;
};

type TournamentRecord = {
  end_date: string;
  name: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  venue_name: string;
};

export type ActiveScannerSession = {
  eventEndDate: string;
  eventName: string;
  eventStartDate: string;
  expiresAt: string;
  gateName: string;
  id: number;
  permissions: string[];
  staffLabel: string;
  tournamentId: number;
  venueName: string;
};

export type ScannerSessionLookup =
  | {
      session: ActiveScannerSession;
      status: "active";
    }
  | {
      status: "expired" | "invalid" | "revoked";
    };

export async function getScannerSessionByToken(
  rawToken: string,
): Promise<ScannerSessionLookup> {
  if (!isValidScannerToken(rawToken)) {
    return { status: "invalid" };
  }

  const supabase = getSupabaseAdmin();
  const tokenHash = hashScannerToken(rawToken);
  const { data: scannerRow, error: scannerError } = await supabase
    .from("scanner_sessions")
    .select(
      "id, tournament_id, gate_name, permissions, expires_at, staff_label, revoked_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (scannerError) {
    throw scannerError;
  }

  if (!scannerRow) {
    return { status: "invalid" };
  }

  const scanner = scannerRow as ScannerSessionRecord;

  if (scanner.revoked_at) {
    return { status: "revoked" };
  }

  if (new Date(scanner.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .select("name, start_date, end_date, venue_name, status")
    .eq("id", scanner.tournament_id)
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  if (!tournamentRow) {
    return { status: "invalid" };
  }

  const tournament = tournamentRow as TournamentRecord;

  if (tournament.status === "closed" || tournament.status === "archived") {
    return { status: "revoked" };
  }

  const activityTimestamp = new Date().toISOString();
  const { data: activityRow, error: activityError } = await supabase
    .from("scanner_sessions")
    .update({ last_active_at: activityTimestamp })
    .eq("id", scanner.id)
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", activityTimestamp)
    .select("id")
    .maybeSingle();

  if (activityError) {
    console.error("[scanner-session] activity update failed", {
      code: activityError.code,
      message: activityError.message,
      scannerSessionId: scanner.id,
    });
  }

  if (!activityError && !activityRow) {
    return { status: "revoked" };
  }

  return {
    session: {
      eventEndDate: tournament.end_date,
      eventName: tournament.name,
      eventStartDate: tournament.start_date,
      expiresAt: scanner.expires_at,
      gateName: scanner.gate_name,
      id: scanner.id,
      permissions: scanner.permissions,
      staffLabel: scanner.staff_label,
      tournamentId: scanner.tournament_id,
      venueName: tournament.venue_name,
    },
    status: "active",
  };
}
