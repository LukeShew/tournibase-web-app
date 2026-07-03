export type ScanSource = "camera" | "manual";

export type ValidatePassInput = {
  candidate: string;
  source: ScanSource;
};

export type OverridePassInput = {
  candidate: string;
  passId: number;
  reason: string;
  source: ScanSource;
};

export type UndoCheckInInput = {
  checkInId: number;
};

export type ValidPassResult = {
  admitCount: number;
  checkInId: number;
  checkInTime: string;
  gateName: string;
  message: string;
  passId: number;
  status: "valid";
  ticketName: string;
  tournamentName: string;
  usesAllowed: number;
  wasManual: boolean;
  wasOverride: boolean;
};

export type PassValidationResult =
  | ValidPassResult
  | {
      admitCount: number;
      attemptId: number;
      firstGateName: string | null;
      firstScannedAt: string | null;
      message: string;
      passId: number;
      status: "already_used";
      ticketName: string;
      usesAllowed: number;
    }
  | {
      attemptId: number;
      message: string;
      passId: number;
      status: "wrong_day";
      ticketName: string;
      validFrom: string;
      validUntil: string;
    }
  | {
      attemptId: number;
      message: string;
      status: "invalid";
    }
  | {
      attemptId: number;
      inactiveReason: "expired" | "refunded" | "voided";
      message: string;
      status: "not_active";
      ticketName: string;
    }
  | {
      message: string;
      status: "invalid_request" | "scanner_unauthorized" | "service_error";
    };

export type UndoCheckInResult =
  | {
      message: string;
      passId: number;
      remainingAdmissions: number;
      status: "undone";
      ticketName: string;
      tournamentName: string;
      undoneAt: string;
    }
  | {
      message: string;
      status:
        | "already_undone"
        | "not_found"
        | "scanner_unauthorized"
        | "service_error";
    };
