"use server";

import { recordGateSale } from "@/lib/gate-sales";
import type {
  RecordGateSaleInput,
  RecordGateSaleResult,
} from "@/lib/gate-sales-types";
import {
  overrideDuplicatePassEntry,
  undoPassCheckIn,
  validatePassForEntry,
} from "@/lib/pass-validation";
import {
  checkInManualLookupPass,
  lookupManualGateOrders,
} from "@/lib/manual-lookup";
import type {
  ManualLookupCheckInInput,
  ManualLookupCheckInResult,
  ManualLookupResult,
} from "@/lib/manual-lookup-types";
import type {
  OverridePassInput,
  PassValidationResult,
  UndoCheckInInput,
  UndoCheckInResult,
  ValidatePassInput,
} from "@/lib/pass-validation-types";
import { getRecentScannerActivity } from "@/lib/recent-scans";
import type { RecentScansResult } from "@/lib/recent-scans-types";

export async function validatePassForScanner(
  scannerToken: string,
  input: ValidatePassInput,
): Promise<PassValidationResult> {
  return validatePassForEntry(scannerToken, input);
}

export async function overridePassForScanner(
  scannerToken: string,
  input: OverridePassInput,
): Promise<PassValidationResult> {
  return overrideDuplicatePassEntry(scannerToken, input);
}

export async function undoCheckInForScanner(
  scannerToken: string,
  input: UndoCheckInInput,
): Promise<UndoCheckInResult> {
  return undoPassCheckIn(scannerToken, input);
}

export async function lookupOrdersForScanner(
  scannerToken: string,
  query: string,
): Promise<ManualLookupResult> {
  return lookupManualGateOrders(scannerToken, query);
}

export async function checkInLookupPassForScanner(
  scannerToken: string,
  input: ManualLookupCheckInInput,
): Promise<ManualLookupCheckInResult> {
  return checkInManualLookupPass(scannerToken, input);
}

export async function recentScansForScanner(
  scannerToken: string,
): Promise<RecentScansResult> {
  return getRecentScannerActivity(scannerToken);
}

export async function recordGateSaleForScanner(
  scannerToken: string,
  input: RecordGateSaleInput,
): Promise<RecordGateSaleResult> {
  return recordGateSale(scannerToken, input);
}
