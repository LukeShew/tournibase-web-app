import type { PassValidationResult } from "@/lib/pass-validation-types";

export type ManualLookupPass = {
  admissionsUsed: number;
  canCheckIn: boolean;
  passId: number;
  status: "active" | "checked_in" | "expired" | "refunded" | "voided";
  ticketName: string;
  usesAllowed: number;
  validFrom: string;
  validUntil: string;
};

export type ManualLookupOrder = {
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string | null;
  createdAt: string;
  orderId: number;
  orderNumber: string;
  passes: ManualLookupPass[];
  paymentStatus:
    | "failed"
    | "paid"
    | "partial_refund"
    | "pending"
    | "refunded";
  scannedPasses: number;
  unusedPasses: number;
};

export type ManualLookupResult =
  | {
      orders: ManualLookupOrder[];
      status: "ok";
    }
  | {
      message: string;
      status: "invalid_request" | "scanner_unauthorized" | "service_error";
    };

export type ManualLookupCheckInInput = {
  passId: number;
};

export type ManualLookupCheckInResult = PassValidationResult;
