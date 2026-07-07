import type { Metadata } from "next";
import {
  LegalPageShell,
  LegalSection,
} from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell eyebrow="Legal" title="Privacy policy">
      <p className="text-sm text-slate-500">Last updated: July 7, 2026</p>

      <LegalSection title="Information TourniBase collects">
        <p>
          TourniBase collects the information needed to run digital admission:
          buyer name, email, optional phone number, optional team information,
          order details, purchased ticket types, pass status, and gate scan
          activity.
        </p>
        <p>
          TourniBase does not store full card numbers. Card payment details are
          handled by Stripe.
        </p>
      </LegalSection>

      <LegalSection title="How the information is used">
        <p>
          TourniBase uses this information to process admission orders, deliver
          pass emails, validate passes at the gate, prevent duplicate or reused
          entry, support refunds, and give event organizers sales and gate
          activity reports.
        </p>
      </LegalSection>

      <LegalSection title="Who can access it">
        <p>
          Event organizers can access information connected to their own events.
          TourniBase also uses trusted service providers for hosting, database,
          payment processing, and email delivery.
        </p>
        <p>
          Current service providers include Vercel, Supabase, Stripe, and
          Resend.
        </p>
      </LegalSection>

      <LegalSection title="Pass and scanner security">
        <p>
          Scanner links are temporary and should not be shared publicly. Pass
          links should only be shared with the buyer’s own guests. Publicly
          posting a pass link can let someone else attempt to use it.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          TourniBase keeps admission records for event operations, reporting,
          refund support, fraud prevention, and basic business recordkeeping.
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          For event-specific questions, contact the event organizer listed on
          the event page or in the confirmation email.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
