import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketTypeFields } from "./ticket-type-fields";

describe("director ticket-price guidance", () => {
  it("explains the base price, buyer fee, and remaining processing cost", () => {
    const html = renderToStaticMarkup(
      <TicketTypeFields defaults={{ validFrom: "2026-10-17", validUntil: "2026-10-18" }} disabled={false} errors={{}} idPrefix="ticket-new" />,
    );
    expect(html).toContain("Base admission price");
    expect(html).toContain("added once per online order");
    expect(html).toContain("processing is still deducted from your proceeds");
    expect(html).toContain('aria-describedby="ticket-new-price-help"');
    expect(html).toContain('aria-describedby="ticket-new-description-help"');
    expect(html).toContain("avoid advertising a base price");
  });

  it("keeps validation errors associated with fields alongside the help text", () => {
    const html = renderToStaticMarkup(
      <TicketTypeFields defaults={{ validFrom: "2026-10-17", validUntil: "2026-10-18" }} disabled={false} errors={{ price: "Enter a valid price.", description: "Description is too long." }} idPrefix="ticket-7" />,
    );
    expect(html).toContain('aria-describedby="ticket-7-price-help ticket-7-price-error"');
    expect(html).toContain('aria-describedby="ticket-7-description-help ticket-7-description-error"');
  });
});
