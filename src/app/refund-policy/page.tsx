import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
} from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Refund policy",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell eyebrow="Support" title="Refund policy">
      <p className="text-sm text-slate-500">Last updated: July 7, 2026</p>

      <LegalSection title="Who handles refunds">
        <p>
          Refund decisions are handled by the tournament or event organizer.
          Buyers should contact the organizer listed on the event page or in
          the TourniBase confirmation email and include their order number.
        </p>
      </LegalSection>

      <LegalSection title="Full refunds">
        <p>
          When a full Stripe refund is processed and Stripe sends the refund
          event to TourniBase, TourniBase marks the order as refunded and blocks
          the order’s active or checked-in passes from future entry.
        </p>
      </LegalSection>

      <LegalSection title="Partial refunds">
        <p>
          Pass-specific partial refunds created from TourniBase order details
          update the refunded total and void the selected pass. A generic
          partial refund created directly in Stripe updates the order total,
          but it cannot identify which pass should be voided.
        </p>
      </LegalSection>

      <LegalSection title="Refund timing">
        <p>
          TourniBase should update pass status shortly after Stripe sends the
          webhook event. The money returning to a card can take longer because
          it depends on Stripe, the card network, and the buyer’s bank.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
