import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
} from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Terms of use">
      <p className="text-sm text-slate-500">Last updated: October 20, 2026</p>

      <LegalSection title="What TourniBase does">
        <p>
          TourniBase provides web-based admission tools for youth sports
          tournament events. The current product helps event organizers sell
          digital admission passes, send pass links to buyers, and validate
          those passes at the gate.
        </p>
      </LegalSection>

      <LegalSection title="Event organizer responsibility">
        <p>
          The event organizer is the seller and merchant of record for
          admission orders. Organizers control their event details, dates,
          venue information, ticket types, pricing, admission rules, refund
          decisions, and gate operations. Buyers should contact the event
          organizer for event-specific questions.
        </p>
      </LegalSection>

      <LegalSection title="Pass use">
        <p>
          Each pass is valid only for the event, date, and ticket type shown.
          Do not post pass links publicly, resell them without permission, or
          try to reuse a pass after it has already been scanned.
        </p>
        <p>
          TourniBase may block duplicate, invalid, voided, expired, or refunded
          passes to protect the event gate.
        </p>
      </LegalSection>

      <LegalSection title="Payments and refunds">
        <p>
          Card payments are processed through the event organizer’s connected
          Stripe account. Stripe controls bank payout timing. TourniBase does
          not store full card numbers. Under the director-free payment setup,
          TourniBase covers ordinary payment processing and the organizer keeps
          the base ticket price on completed sales, before refunds or disputes.
          Historical orders keep the processing arrangement and fees recorded
          when they were purchased; a later plan change does not reprice them.
        </p>
        <p>
          Buyers pay any TourniBase service fee in addition to the ticket
          price. The ticket subtotal, service fee, and total are shown before
          checkout. Stripe transfers the service fee to TourniBase as an
          application fee; it does not reduce the organizer’s ticket price.
          The fee supports online ticketing, mobile passes, and payment handling.
          Refund requests and decisions are handled by the event organizer,
          subject to the cancellation policy and applicable consumer rights.
          Refund timing can depend on Stripe, the card network, and the
          buyer’s bank.
        </p>
      </LegalSection>

      <LegalSection title="Refunds, cancellations, and disputes">
        <p>
          Approved refunds return the refunded ticket’s price and its associated
          TourniBase buyer fee. Organizers return the corresponding ticket
          proceeds; TourniBase returns its fee. Under the director-free setup,
          TourniBase also absorbs payment-processing costs that Stripe does not
          return. Free for directors means ordinary completed ticket sales, not
          that organizers may keep proceeds from refunded or disputed sales.
        </p>
        <p>
          A canceled event requires full refunds, including buyer fees, for its
          affected admission orders. Organizers must notify buyers and coordinate
          refunds promptly, including providing funds if ticket proceeds have
          already been paid out. TourniBase does not automatically detect an
          event cancellation or issue every cancellation refund.
        </p>
        <p>
          Organizers are responsible for valid chargebacks caused by their event
          or actions, including the disputed payment and applicable dispute
          charges. TourniBase covers losses caused by its own errors. Stripe and
          card-network dispute procedures still apply. Contact support so the
          cause, evidence, and allocation can be reviewed; a dispute is not an
          instruction to issue a second refund. These terms do not limit
          nonwaivable consumer rights.
        </p>
        <p>
          See the <a href="/refund-policy" className="font-medium text-brand underline underline-offset-4">refund and dispute policy</a>{' '}
          for the process and refund status guidance.
        </p>
      </LegalSection>

      <LegalSection title="Service availability">
        <p>
          TourniBase is built to support tournament-day admission, but internet,
          device, payment, and third-party service issues can happen. Gate
          staff should have a backup support process for unusual cases.
        </p>
      </LegalSection>

      <LegalSection title="No misuse">
        <p>
          Do not attempt to break, overload, scrape, bypass access controls, or
          interfere with TourniBase, its payment flow, or its scanner links.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
