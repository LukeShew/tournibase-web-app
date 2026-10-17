import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from, rpc }),
}));

import { attemptOrderConfirmationEmail } from "./order-confirmation";
import type { EmailSendRequest } from "./provider";

type Row = Record<string, unknown>;
let order: Row;
let passes: Row[];
let delivery: Row | null;

const items = [
  { id: 10, order_id: 1, quantity: 2, ticket_name: "Saturday Pass", unit_amount_cents: 1800 },
  { id: 11, order_id: 1, quantity: 1, ticket_name: "Sunday Pass", unit_amount_cents: 1800 },
];
const tournament = {
  id: 2,
  contact_email: "director@example.com",
  end_date: "2026-10-18",
  name: "Queen City Fall Classic",
  organizer_name: "Director Organization",
  start_date: "2026-10-17",
  venue_address: "Charlotte, NC",
  venue_name: "Sports Center",
  organizations: { operating_environment: "test" },
};
const send = vi.fn<(request: EmailSendRequest) => Promise<{ messageId: string }>>(
  async () => ({ messageId: "email-1" }),
);
const provider = { isConfigured: true, name: "test-provider", send };

// This query double applies reads and writes with their filters, including the
// environment boundary and the sending claim used to prevent duplicate receipts.
function from(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let changes: Row | undefined;
  function rows() {
    const source = table === "orders" ? [order]
      : table === "passes" ? passes
        : table === "order_items" ? items
          : table === "tournaments" ? [tournament]
            : delivery ? [delivery] : [];
    return source.filter((row) => filters.every((filter) => filter(row)));
  }
  function result() {
    const data = rows();
    if (changes) data.forEach((row) => Object.assign(row, changes));
    return structuredClone(data);
  }
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push((row) => key.split(".").reduce<unknown>(
        (nested, part) => (nested as Row | undefined)?.[part], row,
      ) === value);
      return query;
    },
    order: () => query,
    update: (value: Row) => { changes = value; return query; },
    upsert: async (value: Row, options: { ignoreDuplicates: boolean; onConflict: string }) => {
      expect(options).toEqual({ ignoreDuplicates: true, onConflict: "order_id" });
      delivery ??= { ...value };
      return { error: null };
    },
    maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
    single: async () => ({ data: result()[0] ?? null, error: null }),
    then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result(), error: null })),
  };
  return query;
}

async function rpc(name: string, input: { p_order_id: number }) {
  expect(name).toBe("claim_order_email_delivery");
  expect(input.p_order_id).toBe(1);
  if (!delivery || !["pending", "retryable_failure"].includes(String(delivery.status))) {
    return { data: [], error: null };
  }
  delivery.status = "sending";
  return { data: [structuredClone(delivery)], error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.tournibase.com");
  delivery = null;
  order = {
    id: 1,
    tournament_id: 2,
    buyer_name: "Jordan Ellis",
    buyer_email: "jordan@example.com",
    amount_total: "54.00",
    amount_refunded: "0.00",
    payment_status: "paid",
    stripe_environment: "test",
    tournaments: { organizations: { operating_environment: "test" } },
  };
  passes = [
    { id: 1, order_id: 1, order_item_id: 10, sequence_number: 1, status: "active", public_token: "saturday-first" },
    { id: 2, order_id: 1, order_item_id: 10, sequence_number: 2, status: "checked_in", public_token: "saturday-second" },
    { id: 3, order_id: 1, order_item_id: 11, sequence_number: 1, status: "active", public_token: "sunday-refunded" },
  ];
});

afterEach(() => vi.unstubAllEnvs());

describe("initial order receipts after refunds", () => {
  it("loads the stored buyer fee without changing the ticket line prices", async () => {
    order.buyer_fee_amount = "1.38";
    order.amount_total = "55.38";

    expect((await attemptOrderConfirmationEmail(1, provider)).status).toBe("sent");
    const request = send.mock.calls[0][0];
    expect(request.text).toContain("2 × Saturday Pass: $36.00");
    expect(request.text).toContain("1 × Sunday Pass: $18.00");
    expect(request.text).toContain("Ticket subtotal: $54.00");
    expect(request.text).toContain("TourniBase service fee: $1.38");
    expect(request.text).toContain("Amount paid: $55.38");
  });

  it("sends the first receipt after a partial refund with only remaining pass links", async () => {
    order.payment_status = "partial_refund";
    order.amount_refunded = "18.00";
    passes[2].status = "refunded";

    expect(await attemptOrderConfirmationEmail(1, provider)).toEqual({ status: "sent", messageId: "email-1" });

    const request = send.mock.calls[0][0];
    expect(request.idempotencyKey).toBe("order-confirmation-1");
    expect(request.to).toBe("jordan@example.com");
    expect(request.replyTo).toBe("director@example.com");
    for (const body of [request.text, request.html]) {
      expect(body).toContain("saturday-first");
      expect(body).toContain("saturday-second");
      expect(body).not.toContain("sunday-refunded");
      expect(body).toContain("partially refunded");
      expect(body).toContain("Original amount paid");
      expect(body).toContain("$54.00");
      expect(body).toContain("$18.00");
      expect(body).toContain("Amount after refunds");
      expect(body).toContain("$36.00");
    }
    expect(delivery).toMatchObject({ status: "sent", provider_message_id: "email-1" });
  });

  it("keeps all usable passes for an amount-only partial refund", async () => {
    order.payment_status = "partial_refund";
    order.amount_refunded = "5.00";

    expect((await attemptOrderConfirmationEmail(1, provider)).status).toBe("sent");
    const request = send.mock.calls[0][0];
    expect(request.text.match(/Open pass:/g)).toHaveLength(3);
    expect(request.text).toContain("Amount after refunds: $49.00");
  });

  it("does not send a second initial receipt after a later partial refund", async () => {
    expect((await attemptOrderConfirmationEmail(1, provider)).status).toBe("sent");
    order.payment_status = "partial_refund";
    order.amount_refunded = "18.00";
    passes[2].status = "refunded";

    expect(await attemptOrderConfirmationEmail(1, provider)).toEqual({ status: "already_sent" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "failed", "refunded"])("does not send pass receipts for a %s order", async (status) => {
    order.payment_status = status;

    expect(await attemptOrderConfirmationEmail(1, provider)).toEqual({
      status: "permanent_failure", code: "email_order_not_paid",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["refunded", "voided", "expired"])("excludes %s pass links even on a paid order", async (status) => {
    passes[2].status = status;

    expect((await attemptOrderConfirmationEmail(1, provider)).status).toBe("sent");
    expect(send.mock.calls[0][0].text).not.toContain("sunday-refunded");
  });

  it("waits for all original passes before sending a partially refunded order", async () => {
    order.payment_status = "partial_refund";
    order.amount_refunded = "18.00";
    passes.pop();

    expect(await attemptOrderConfirmationEmail(1, provider)).toEqual({
      status: "retryable_failure", code: "email_passes_not_ready",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("does not send a passes-ready message when no passes remain usable", async () => {
    order.payment_status = "partial_refund";
    order.amount_refunded = "18.00";
    passes.forEach((pass) => { pass.status = "refunded"; });

    expect(await attemptOrderConfirmationEmail(1, provider)).toEqual({
      status: "permanent_failure", code: "email_no_available_passes",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects a cross-environment order before claiming or sending email", async () => {
    order.stripe_environment = "live";

    await expect(attemptOrderConfirmationEmail(1, provider)).rejects.toMatchObject({
      code: "email_order_environment_mismatch",
    });
    expect(delivery).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
