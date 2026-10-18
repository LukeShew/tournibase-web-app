import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicTicketForm, TicketOfferPrice, TicketPriceSummary } from "./public-ticket-form";

describe("upfront ticket offer pricing", () => {
  it("advertises the fee-inclusive one-pass total, not just the base price", () => {
    const html = renderToStaticMarkup(<TicketOfferPrice ticketPrice={10} platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} />);
    expect(html).toContain("$10.50");
    expect(html).not.toContain("$10.00");
    expect(html).toContain("Total for 1 pass, fees included");
  });

  it.each([
    { price: 0, configuration: { basisPoints: 200, fixedCents: 30 }, expected: "$0.00" },
    { price: "10.00", configuration: { basisPoints: 0, fixedCents: 0 }, expected: "$10.00" },
  ])("keeps free and zero-fee offers accurate", ({ price, configuration, expected }) => {
    const html = renderToStaticMarkup(<TicketOfferPrice ticketPrice={price} platformFeeConfiguration={configuration} />);
    expect(html).toContain(expected);
    expect(html).not.toContain("fees included");
  });

  it("shows the order total before requesting buyer information", () => {
    const html = renderToStaticMarkup(<PublicTicketForm eventName="Tournament" eventSlug="tournament" eventTimeZone="America/New_York" platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} tickets={[{ id: 1, name: "Saturday", price: 10, quantityLimit: 10, description: null, validFrom: "2026-10-17T04:00:00Z", validUntil: "2026-10-18T03:59:59Z" }]} />);
    expect(html).toContain("$10.50");
    expect(html.indexOf('aria-label="Order total"')).toBeLessThan(html.indexOf("Buyer information"));
    expect(html).toContain("fee is calculated once on the whole order");
  });
});

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

  it("charges $20.70 for two $10 passes, not two single-pass $10.50 quotes", () => {
    const html = renderToStaticMarkup(<TicketPriceSummary ticketSubtotalCents={2000} platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} />);
    expect(html).toContain("$20.70");
    expect(html).not.toContain("$21.00");
    expect(html).toContain("For online ticketing and digital pass delivery.");
  });

  it("uses one order fee for mixed paid prices and free passes", () => {
    const subtotal = 2 * 1000 + 1499 + 3 * 0;
    const html = renderToStaticMarkup(<TicketPriceSummary ticketSubtotalCents={subtotal} platformFeeConfiguration={{ basisPoints: 200, fixedCents: 30 }} />);
    expect(html).toContain("$34.99");
    expect(html).toContain("$1.00");
    expect(html).toContain("$35.99");
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
