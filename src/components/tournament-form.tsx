"use client";

import { useActionState, useState } from "react";
import {
  createTournament,
  initialCreateTournamentState,
} from "@/app/dashboard/tournaments/new/actions";
import { slugifyTournamentName } from "@/lib/tournaments";

type TournamentFormProps = {
  defaultContactEmail: string;
  defaultOrganizerName: string;
};

const inputClassName =
  "mt-2 h-12 w-full rounded-xl border border-border bg-black/20 px-4 text-base text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70";

export function TournamentForm({
  defaultContactEmail,
  defaultOrganizerName,
}: TournamentFormProps) {
  const [state, action, pending] = useActionState(
    createTournament,
    initialCreateTournamentState,
  );
  const [tournamentName, setTournamentName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  function updateTournamentName(value: string) {
    setTournamentName(value);

    if (!slugWasEdited) {
      setPublicSlug(value ? slugifyTournamentName(value) : "");
    }
  }

  function updatePublicSlug(value: string) {
    setSlugWasEdited(true);
    setPublicSlug(value ? slugifyTournamentName(value) : "");
  }

  return (
    <form action={action} className="mt-8 space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
            Event basics
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
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
              value={tournamentName}
              onChange={(event) => updateTournamentName(event.target.value)}
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.name)}
              aria-describedby={state.errors.name ? "name-error" : undefined}
              disabled={pending}
              className={inputClassName}
              placeholder="Carolina Summer Tip-Off"
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

          <FormField
            id="publicSlug"
            label="Public event link"
            error={state.errors.publicSlug}
          >
            <div className="mt-2 flex h-12 overflow-hidden rounded-xl border border-border bg-black/20 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
              <span className="flex items-center border-r border-border bg-white/5 px-3 font-mono text-sm text-slate-500">
                /e/
              </span>
              <input
                id="publicSlug"
                name="publicSlug"
                value={publicSlug}
                onChange={(event) => updatePublicSlug(event.target.value)}
                maxLength={72}
                aria-invalid={Boolean(state.errors.publicSlug)}
                aria-describedby={
                  state.errors.publicSlug ? "publicSlug-error" : undefined
                }
                disabled={pending}
                className="min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none disabled:cursor-wait disabled:opacity-70"
                placeholder="carolina-summer-tip-off"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Generated from the tournament name. You can customize it.
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
              maxLength={800}
              aria-invalid={Boolean(state.errors.description)}
              aria-describedby={
                state.errors.description ? "description-error" : undefined
              }
              disabled={pending}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-black/20 px-4 py-3 text-base leading-6 text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70"
              placeholder="A short description parents will see on the public admission page."
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
            Schedule and location
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
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
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.venueName)}
              aria-describedby={
                state.errors.venueName ? "venueName-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
              placeholder="Carolina Sports Center"
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
              required
              maxLength={240}
              aria-invalid={Boolean(state.errors.venueAddress)}
              aria-describedby={
                state.errors.venueAddress ? "venueAddress-error" : undefined
              }
              disabled={pending}
              className={inputClassName}
              placeholder="123 Court Lane, Charlotte, NC"
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
            Event contact
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
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
              defaultValue={defaultOrganizerName}
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
              defaultValue={defaultContactEmail}
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
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-medium text-white">Create as a draft</p>
          <p className="mt-1 text-sm text-slate-500">
            Ticket sales stay off until ticket types and publishing are ready.
          </p>
          {state.message ? (
            <p className="mt-2 text-sm text-red-300">{state.message}</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Creating event…" : "Create admission event"}
        </button>
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
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-sm text-red-300" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
