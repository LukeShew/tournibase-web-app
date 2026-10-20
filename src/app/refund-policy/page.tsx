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
      <p className="text-sm text-slate-500">Last updated: October 20, 2026</p>

      <LegalSection title="The short version">
        <p>
          Approved refunds include the refunded ticket’s price and its TourniBase
          buyer fee. Canceled events require full refunds for affected admission
          orders. Under the director-free setup, TourniBase absorbs nonreturned
          processing costs; organizers still return refunded ticket proceeds and
          cover valid event-related chargebacks. TourniBase covers losses caused
          by its own errors.
        </p>
      </LegalSection>

      <LegalSection title="Who handles refunds">
        <p>
          The tournament or event organizer is the seller for admission orders
          and handles refund decisions. Buyers should contact the organizer
          listed on the event page or in the TourniBase confirmation email and
          include their order number.
        </p>
      </LegalSection>

      <LegalSection title="Canceled events">
        <p>
          If an event is canceled, the organizer must notify buyers and arrange
          full refunds of the affected admission orders, including TourniBase
          buyer fees. Contact the organizer or TourniBase support with the event
          and order number. Cancellation refunds require action by the organizer
          and support; they are not triggered automatically by editing an event.
        </p>
      </LegalSection>

      <LegalSection title="Who covers refund costs">
        <p>
          The organizer returns the ticket proceeds and TourniBase returns its
          buyer fee. Under the director-free setup, TourniBase absorbs original
          processing costs that Stripe does not return. If proceeds have already
          been paid out, the organizer remains responsible for funding the
          ticket-price portion. Historical orders retain their original payment
          arrangement rather than being repriced by a later plan change.
        </p>
      </LegalSection>

      <LegalSection title="Payment disputes and chargebacks">
        <p>
          Organizers cover valid chargebacks caused by their event or actions,
          including the disputed payment and applicable dispute charges.
          TourniBase covers losses caused by its own errors. Support reviews
          the cause and evidence, while Stripe and card-network procedures
          determine the payment dispute. Do not send a separate refund for an
          open dispute without checking with support, to avoid paying twice.
          Nothing in this policy limits rights that applicable law gives buyers.
        </p>
      </LegalSection>

      <LegalSection title="Full refunds">
        <p>
          When a full Stripe refund is processed and Stripe sends the refund
          event to TourniBase, TourniBase marks the order as refunded and blocks
          the order’s active or checked-in passes from future entry.
          A full refund includes any TourniBase service fee paid by the buyer.
        </p>
      </LegalSection>

      <LegalSection title="Partial refunds">
        <p>
          Pass-specific partial refunds created from TourniBase order details
          include the selected ticket’s price and its share of any buyer-paid
          TourniBase service fee, update the refunded total, and void the
          selected pass. A generic
          partial refund created directly in Stripe updates the order total,
          but it cannot identify which pass should be voided.
        </p>
      </LegalSection>

      <LegalSection title="Refund timing">
        <p>
          Refunds are processed through the organizer’s connected Stripe
          account. TourniBase should update pass status shortly after Stripe
          sends the webhook event. A pending refund is not a completed refund.
          A failed refund requires support review; do not submit it repeatedly.
          The money returning to a card can take
          longer because it depends on Stripe, the card network, and the
          buyer’s bank.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
