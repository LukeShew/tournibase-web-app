export type RecentScanResult =
  | "already_used"
  | "invalid"
  | "manual_check_in"
  | "override"
  | "refunded"
  | "valid"
  | "voided"
  | "wrong_day";

export type RecentScan = {
  buyerName: string | null;
  checkInId: number;
  gateName: string;
  overrideReason: string | null;
  result: RecentScanResult;
  scannedAt: string;
  source: "camera" | "manual";
  ticketName: string | null;
  wasOverride: boolean;
  wasUndone: boolean;
};

export type RecentScansResult =
  | {
      scans: RecentScan[];
      status: "ok";
      timeZone: string;
    }
  | {
      message: string;
      status: "invalid_request" | "scanner_unauthorized" | "service_error";
    };
