"use server";

import {
  overrideDuplicatePassEntry,
  undoPassCheckIn,
  validatePassForEntry,
} from "@/lib/pass-validation";
import type {
  OverridePassInput,
  PassValidationResult,
  UndoCheckInInput,
  UndoCheckInResult,
  ValidatePassInput,
} from "@/lib/pass-validation-types";

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
