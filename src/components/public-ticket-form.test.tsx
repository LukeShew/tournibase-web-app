import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketPriceSummary } from "./public-ticket-form";

describe("buyer checkout price summary", () => {
  it("shows a $10 ticket plus the $0.50 buyer fee before checkout", () => {
    const html = renderToStaticMarkup(<TicketPriceSummary ticketSubtotalCents={1000} platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} />);
    expect(html).toContain("Ticket subtotal");
    expect(html).toContain("$10.00");
    expect(html).toContain("TourniBase service fee");
    expect(html).toContain("$0.50");
    expect(html).toContain("$10.50");
  });

  it("applies the fixed fee once for a multi-pass order", () => {
    const html = renderToStaticMarkup(<TicketPriceSummary ticketSubtotalCents={3000} platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} />);
    expect(html).toContain("$30.00");
    expect(html).toContain("$0.90");
    expect(html).toContain("$30.90");
  });

  it.each([
    { subtotal: 0, configuration: { basisPoints: 200, fixedCents: 30 }, expected: "$0.00" },
    { subtotal: 1000, configuration: { basisPoints: 0, fixedCents: 0 }, expected: "$10.00" },
  ])("keeps free orders and zero-fee environments fee-free", ({ subtotal, configuration, expected }) => {
    const html = renderToStaticMarkup(<TicketPriceSummary ticketSubtotalCents={subtotal} platformFeeConfiguration={configuration} />);
    expect(html).not.toContain("TourniBase service fee");
    expect(html).toContain(expected);
  });
});
