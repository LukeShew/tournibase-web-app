"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateTournament } from "@/app/dashboard/tournaments/[id]/edit/actions";
import { initialCreateTournamentState } from "@/lib/form-states";

type EditableTournament = {
  contact_email: string;
  description: string | null;
  end_date: string;
  id: number;
  name: string;
  organizer_name: string;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  venue_address: string | null;
  venue_name: string;
};

type EventDetailsEditFormProps = {
  tournament: EditableTournament;
};

const inputClassName =
  "mt-2 h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70";

export function EventDetailsEditForm({
  tournament,
}: EventDetailsEditFormProps) {
  const [actionState, action, pending] = useActionState(
    updateTournament,
    initialCreateTournamentState,
  );
  const state = actionState ?? initialCreateTournamentState;

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="tournamentId" value={tournament.id} />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Event basics
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Tournament details
          </h2>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField
            id="name"
            label="Tournament name"
            error={state.errors.name}
            className="sm:col-span-2"
          >
            <input
              id="name"
              name="name"
              defaultValue={tournament.name}
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.name)}
              aria-describedby={state.errors.name ? "name-error" : undefined}
              disabled={pending}
              className={inputClassName}
            />
          </FormField>

          <FormField id="sport" label="Sport">
            <input
              id="sport"
              value="Youth basketball"
              readOnly
              disabled
              className={inputClassName}
            />
          </FormField>

          <FormField id="publicSlug" label="Public event link">
            <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-border bg-white">
              <span className="flex items-center border-r border-border bg-card-strong px-3 font-mono text-sm text-slate-500">
                /e/
              </span>
              <input
                id="publicSlug"
                value={tournament.public_slug}
                readOnly
                disabled
                className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-slate-500 focus:outline-none"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This is locked here so already-shared links do not break.
            </p>
          </FormField>

          <FormField
            id="description"
            label="Short event description"
            error={state.errors.description}
            className="sm:col-span-2"
          >
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={tournament.description ?? ""}
              maxLength={800}
              aria-invalid={Boolean(state.errors.description)}
              aria-describedby={
                state.errors.description ? "description-error" : undefined
              }
              disabled={pending}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-base leading-6 text-slate-950 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="A short description parents will see on the public admission page."
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Schedule and location
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            When and where
          </h2>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField
            id="startDate"
            label="Start date"
            error={state.errors.startDate}
          >
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={tournament.start_date}
              required
              aria-invalid={Boolean(state.errors.startDate)}
              aria-describedby={
                state.errors.startDate ? "startDate-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="endDate"
            label="End date"
            error={state.errors.endDate}
          >
            <input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={tournament.end_date}
              required
              aria-invalid={Boolean(state.errors.endDate)}
              aria-describedby={
                state.errors.endDate ? "endDate-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="venueName"
            label="Venue name"
            error={state.errors.venueName}
          >
            <input
              id="venueName"
              name="venueName"
              defaultValue={tournament.venue_name}
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.venueName)}
              aria-describedby={
                state.errors.venueName ? "venueName-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="venueAddress"
            label="Venue address"
            error={state.errors.venueAddress}
          >
            <input
              id="venueAddress"
              name="venueAddress"
              autoComplete="street-address"
              defaultValue={tournament.venue_address ?? ""}
              required
              maxLength={240}
              aria-invalid={Boolean(state.errors.venueAddress)}
              aria-describedby={
                state.errors.venueAddress ? "venueAddress-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>
        </div>

        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          If ticket types already exist, review their valid dates after saving.
          This form updates event details, not each ticket’s scan window.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Event contact
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Organizer details
          </h2>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField
            id="organizerName"
            label="Organizer or director name"
            error={state.errors.organizerName}
          >
            <input
              id="organizerName"
              name="organizerName"
              defaultValue={tournament.organizer_name}
              autoComplete="name"
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.organizerName)}
              aria-describedby={
                state.errors.organizerName
                  ? "organizerName-error"
                  : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>

          <FormField
            id="contactEmail"
            label="Contact email"
            error={state.errors.contactEmail}
          >
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={tournament.contact_email}
              autoComplete="email"
              required
              maxLength={254}
              aria-invalid={Boolean(state.errors.contactEmail)}
              aria-describedby={
                state.errors.contactEmail ? "contactEmail-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
            />
          </FormField>
        </div>
      </section>

      <div
        aria-live="polite"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-medium text-slate-950">Save event details</p>
          <p className="mt-1 text-sm text-slate-500">
            Public pages and dashboard views use these details immediately.
          </p>
          {state.message ? (
            <p className="mt-2 text-sm text-red-600">{state.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/dashboard/tournaments/${tournament.id}`}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Saving event…" : "Save event"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FormField({
  children,
  className = "",
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-red-600" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
