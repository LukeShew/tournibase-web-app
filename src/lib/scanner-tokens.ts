import "server-only";

import { createHash, randomBytes } from "node:crypto";

const SCANNER_TOKEN_PATTERN = /^scan_[A-Za-z0-9_-]{43}$/;

export function createScannerToken() {
  return `scan_${randomBytes(32).toString("base64url")}`;
}

export function hashScannerToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidScannerToken(token: string) {
  return SCANNER_TOKEN_PATTERN.test(token);
}
