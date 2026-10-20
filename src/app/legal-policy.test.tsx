import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/legal-page-shell", () => ({
  LegalPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  LegalSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section><h2>{title}</h2>{children}</section>
  ),
}));

import TermsPage from "./terms/page";
import RefundPolicyPage from "./refund-policy/page";

describe("approved launch refund and dispute policy", () => {
  it("distinguishes director-free sales from refund and dispute obligations", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("TourniBase covers ordinary payment processing");
    expect(html).toContain("Historical orders keep the processing arrangement");
    expect(html).toContain("TourniBase also absorbs payment-processing costs");
    expect(html).toContain("A canceled event requires full refunds");
    expect(html).toContain("Organizers are responsible for valid chargebacks");
    expect(html).toContain("TourniBase covers losses caused by its own errors");
    expect(html).not.toContain("Stripe deducts its processing fees from the");
  });

  it("explains buyer-fee refunds, manual cancellation handling and pending status", () => {
    const html = renderToStaticMarkup(<RefundPolicyPage />);
    expect(html).toContain("Approved refunds include");
    expect(html).toContain("Canceled events require full refunds");
    expect(html).toContain("they are not triggered automatically by editing an event");
    expect(html).toContain("A pending refund is not a completed refund");
    expect(html).toContain("do not submit it repeatedly");
    expect(html).toContain("avoid paying twice");
  });
});
