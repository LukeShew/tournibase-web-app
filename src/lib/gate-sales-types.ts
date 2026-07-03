export type GateSalePaymentMethod =
  | "card_outside_tournibase"
  | "cash"
  | "comp"
  | "venmo";

export type GateSaleTicketOption = {
  id: number;
  name: string;
  price: number;
  validFrom: string;
  validUntil: string;
};

export type RecordGateSaleInput = {
  buyerName: string;
  notes: string;
  paymentMethod: GateSalePaymentMethod;
  quantity: number;
  ticketTypeId: number;
};

export type RecordGateSaleResult =
  | {
      amount: number;
      buyerName: string | null;
      gateName: string;
      message: string;
      paymentMethod: GateSalePaymentMethod;
      quantity: number;
      recordedAt: string;
      saleId: number;
      status: "recorded";
      ticketName: string;
      tournamentName: string;
    }
  | {
      message: string;
      status: "invalid_request" | "scanner_unauthorized" | "service_error";
    };
