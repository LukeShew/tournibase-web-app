import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
} from "@/components/legal-page-shell";
import { SupportForm } from "@/components/support-form";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportPage() {
  return (
    <LegalPageShell eyebrow="Support" title="Support">
      <p className="text-sm text-slate-500">Last updated: July 7, 2026</p>

      <LegalSection title="For spectators and parents">
        <p>
          Use the confirmation email from TourniBase to open your mobile pass,
          save a backup image to your device, or find your order number.
        </p>
        <p>
          For event-specific help, ticket questions, or refund requests, contact
          the event organizer listed on the event page or in your confirmation
          email.
        </p>
      </LegalSection>

      <LegalSection title="At the gate">
        <p>
          If your phone service is weak, show the saved pass image from Photos
          or Files. Gate staff still need internet access on the scanner device
          so TourniBase can check duplicate use, refunds, and pass validity.
        </p>
      </LegalSection>

      <LegalSection title="For directors">
        <p>
          Use the dashboard to review orders, scan activity, manual lookup,
          sales totals, scanner links, and event setup. Individual passes can
          be refunded from order details, and full-order refunds can be
          completed from the linked Stripe payment.
        </p>
      </LegalSection>

      <LegalSection title="Contact TourniBase">
        <p>Send a message for account, setup, or technical help.</p>
        <SupportForm />
      </LegalSection>
    </LegalPageShell>
  );
}
