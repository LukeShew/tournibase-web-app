import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  PublicTicketForm,
  type PublicTicketOption,
} from "@/components/public-ticket-form";
import {
  PARENT_PROMISE,
  PRODUCT_POSITIONING,
} from "@/lib/product-copy";
import { getPublicEvent } from "@/lib/public-events";
import { isOrganizationStripeAccountReady } from "@/lib/stripe-connect";
import { formatEventDateRange } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ "event-slug": string }>;
  searchParams: Promise<{ checkout?: string }>;
};

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { "event-slug": eventSlug } = await params;
  const event = isValidEventSlug(eventSlug)
    ? await getPublicEvent(eventSlug)
    : null;

  if (!event) {
    return {
      title: "Event not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${event.name} admission`,
    description: `${PARENT_PROMISE} Buy digital admission passes for ${event.name} at ${event.venue_name}.`,
  };
}

export default async function PublicEventPage({
  params,
  searchParams,
}: EventPageProps) {
  const { "event-slug": eventSlug } = await params;
  const { checkout } = await searchParams;

  if (!isValidEventSlug(eventSlug)) {
    notFound();
  }

  const event = await getPublicEvent(eventSlug);

  if (!event) {
    notFound();
  }

  const hasPaidTickets = event.ticketTypes.some(
    (ticket) => Number(ticket.price) > 0,
  );
  const paymentReady =
    !hasPaidTickets ||
    (await isOrganizationStripeAccountReady(event.organization_id));
  const availableTicketTypes = paymentReady
    ? event.ticketTypes
    : event.ticketTypes.filter((ticket) => Number(ticket.price) === 0);
  const ticketOptions: PublicTicketOption[] = availableTicketTypes.map(
    (ticket) => ({
      description: ticket.description,
      id: ticket.id,
      name: ticket.name,
      price: ticket.price,
      quantityLimit: ticket.quantity_limit,
      validFrom: ticket.valid_from,
      validUntil: ticket.valid_until,
    }),
  );

  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
          <Brand />
          <span className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
            Secure digital admission
          </span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <aside className="lg:sticky lg:top-8">
            <p className="text-sm font-medium text-blue-300">
              Youth basketball admission
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              {event.name}
            </h1>
            <p className="mt-5 text-xl font-medium leading-8 text-slate-200">
              {PARENT_PROMISE}
            </p>

            <dl className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/90">
              <EventDetail
                label="Dates"
                value={formatEventDateRange(
                  event.start_date,
                  event.end_date,
                )}
              />
              <EventDetail label="Venue" value={event.venue_name} />
              <EventDetail
                label="Address"
                value={event.venue_address || "Address provided by organizer"}
              />
              <EventDetail label="Organizer" value={event.organizer_name} />
            </dl>

            {event.description ? (
              <p className="mt-6 text-sm leading-7 text-slate-400">
                {event.description}
              </p>
            ) : null}
          </aside>

          <div>
            {checkout === "cancelled" ? (
              <div
                role="status"
                className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-5 py-4 text-sm leading-6 text-amber-100"
              >
                Checkout was cancelled. No payment was taken, and your ticket
                selection is still available below.
              </div>
            ) : null}
            {hasPaidTickets && !paymentReady ? (
              <div
                role="status"
                className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-100"
              >
                Paid online checkout is temporarily unavailable while{" "}
                {event.organizer_name} completes payment setup. Free admission
                options, if offered, remain available below. Contact the
                organizer for paid admission help.
              </div>
            ) : null}
            {ticketOptions.length > 0 ? (
              <PublicTicketForm
                eventName={event.name}
                eventSlug={event.public_slug}
                eventTimeZone={event.time_zone}
                tickets={ticketOptions}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-card/70 px-6 py-14 text-center">
                <h2 className="text-xl font-semibold text-white">
                  Online passes are unavailable
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                  {hasPaidTickets && !paymentReady
                    ? "Paid online checkout is temporarily unavailable while the organizer completes payment setup. Contact the organizer for admission information."
                    : "This event does not currently have passes available. Contact the organizer for admission information."}
                </p>
              </div>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoCard title="Admission policy">
                Passes are valid only for the event and dates shown. Each guest
                will need their own digital pass at the gate.
              </InfoCard>
              <InfoCard title="Seller, refunds, and support">
                {event.organizer_name} is the seller for admission orders. For
                admission help or refund requests, email the organizer and
                include your order number.{" "}
                <a
                  href={`mailto:${event.contact_email}`}
                  className="font-medium text-blue-300 underline decoration-blue-300/40 underline-offset-4 hover:text-blue-200"
                >
                  Contact {event.organizer_name}
                </a>
                .
              </InfoCard>
            </section>

            <p className="mt-6 text-center text-xs leading-5 text-slate-600">
              {PRODUCT_POSITIONING}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function EventDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-6 text-slate-200">{value}</dd>
    </div>
  );
}

function InfoCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>
    </div>
  );
}

function isValidEventSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 72;
}
