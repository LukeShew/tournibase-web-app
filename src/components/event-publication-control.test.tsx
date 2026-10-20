import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/tournaments/[id]/actions", () => ({
  setTournamentPublication: async () => ({ success: true, message: "" }),
}));

import { EventPublicationControl } from "./event-publication-control";

const defaults = {
  activeTicketCount: 1,
  checkoutConfigured: true,
  connectConfigured: true,
  hasPaidTickets: true,
  organizationId: 7,
  paymentReady: false,
  publicPath: "/e/weekend-classic",
  status: "draft" as const,
  tournamentId: 12,
};

describe("payment setup publication controls", () => {
  it("offers settings help instead of reconnecting when processing setup needs support", () => {
    const html = renderToStaticMarkup(
      <EventPublicationControl {...defaults} processingSetupRequired />,
    );
    expect(html).toContain('href="/dashboard/settings?event=12"');
    expect(html).toContain("Payment setup help");
    expect(html).toContain("Contact TourniBase support in Settings");
    expect(html).not.toContain('action="/api/stripe/connect/start"');
    expect(html).not.toContain("Connect Stripe");
    expect(html).toContain('disabled=""');
  });

  it("preserves Connect Stripe for ordinary onboarding and legacy policies", () => {
    const html = renderToStaticMarkup(<EventPublicationControl {...defaults} />);
    expect(html).toContain('action="/api/stripe/connect/start"');
    expect(html).toContain("Connect Stripe");
    expect(html).not.toContain("Payment setup help");
  });

  it("still lets a published event return to draft while fee setup is blocked", () => {
    const html = renderToStaticMarkup(
      <EventPublicationControl {...defaults} status="published" processingSetupRequired />,
    );
    expect(html).toContain("Return to draft");
    expect(html).toContain("Payment setup help");
    expect(html).not.toContain('disabled=""');
  });

  it("hides payment setup actions for eligible and free events", () => {
    for (const props of [
      { ...defaults, paymentReady: true },
      { ...defaults, hasPaidTickets: false, processingSetupRequired: true },
    ]) {
      const html = renderToStaticMarkup(<EventPublicationControl {...props} />);
      expect(html).not.toContain("Connect Stripe");
      expect(html).not.toContain("Payment setup help");
    }
  });
});
