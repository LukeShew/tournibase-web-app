import { describe, expect, it } from "vitest";
import { getIdlePublicationMessage } from "./publication-message";

describe("event publication messaging", () => {
  it("keeps a published free-only event ready without Stripe configuration", () => {
    expect(
      getIdlePublicationMessage({
        activeTicketCount: 1,
        checkoutConfigured: false,
        hasPaidTickets: false,
        paymentReady: true,
        status: "published",
      }),
    ).toEqual({
      className: "text-emerald-700",
      text: "The free ticket page is public and ready for guests.",
    });
  });

  it("blocks a paid draft when connected-payment configuration is incomplete", () => {
    expect(
      getIdlePublicationMessage({
        activeTicketCount: 1,
        checkoutConfigured: false,
        hasPaidTickets: true,
        paymentReady: true,
        status: "draft",
      }).text,
    ).toContain("Paid checkout setup is incomplete");
  });

  it("pauses a published paid event when its connected account is restricted", () => {
    expect(
      getIdlePublicationMessage({
        activeTicketCount: 1,
        checkoutConfigured: true,
        hasPaidTickets: true,
        paymentReady: false,
        status: "published",
      }).text,
    ).toContain("paid checkout is paused");
  });
});
