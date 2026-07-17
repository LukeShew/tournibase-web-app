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
      <p className="text-sm text-slate-500">Last updated: July 16, 2026</p>

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
          Stripe account. Stripe deducts its processing fees from the
          organizer’s proceeds and controls the organizer’s bank payout
          schedule. TourniBase does not store full card numbers.
        </p>
        <p>
          TourniBase may retain an application fee from an organizer’s
          transaction proceeds. The pilot application fee is currently $0.
          Refund requests and decisions are handled by the event organizer.
          Refund timing can depend on Stripe, the card network, and the buyer’s
          bank.
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
