"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createScannerSession } from "@/app/dashboard/tournaments/[id]/gate/actions";
import { initialScannerSessionFormState } from "@/lib/form-states";

export function CreateScannerSessionForm({
  tournamentId,
  tournamentName,
}: {
  tournamentId: number;
  tournamentName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const resetTimer = useRef<number | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy scanner link");
  const createForTournament = createScannerSession.bind(null, tournamentId);
  const [actionState, action, pending] = useActionState(
    createForTournament,
    initialScannerSessionFormState,
  );
  const state = actionState ?? initialScannerSessionFormState;

  useEffect(() => {
    if (state.successId) {
      formRef.current?.reset();
    }
  }, [state.successId]);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function copyScannerLink() {
    if (!state.scannerUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.scannerUrl);
      showTemporaryCopyLabel("Copied");
    } catch {
      showTemporaryCopyLabel("Copy failed");
    }
  }

  function showTemporaryCopyLabel(label: string) {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }

    setCopyLabel(label);
    resetTimer.current = window.setTimeout(
      () => setCopyLabel("Copy scanner link"),
      1800,
    );
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={action}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6"
      >
        <div className="border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
            New scanner access
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Create a gate link
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Assign access to one gate team or device. The link expires
            automatically.
          </p>
        </div>

        <div className="mt-6 grid gap-5">
          <Field label="Tournament" htmlFor="scanner-tournament">
            <input
              id="scanner-tournament"
              type="text"
              value={tournamentName}
              readOnly
              className={readOnlyInputClass}
            />
          </Field>

          <Field
            label="Gate name"
            htmlFor="scanner-gate-name"
            error={state.errors.gateName}
          >
            <input
              id="scanner-gate-name"
              name="gateName"
              type="text"
              minLength={2}
              maxLength={80}
              required
              disabled={pending}
              placeholder="Main entrance"
              className={inputClass}
            />
          </Field>

          <Field
            label="Staff label"
            htmlFor="scanner-staff-label"
            error={state.errors.staffLabel}
            help="A name for the assigned person, group, or device."
          >
            <input
              id="scanner-staff-label"
              name="staffLabel"
              type="text"
              minLength={2}
              maxLength={100}
              required
              disabled={pending}
              placeholder="Saturday morning crew"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Permission level"
              htmlFor="scanner-permission-level"
              error={state.errors.permissionLevel}
            >
              <select
                id="scanner-permission-level"
                name="permissionLevel"
                defaultValue="standard"
                required
                disabled={pending}
                className={inputClass}
              >
                <option value="scan_only">Scan only</option>
                <option value="standard">Standard gate</option>
                <option value="full">Full gate access</option>
              </select>
            </Field>

            <Field
              label="Expiration"
              htmlFor="scanner-expiration"
              error={state.errors.expirationHours}
            >
              <select
                id="scanner-expiration"
                name="expirationHours"
                defaultValue="12"
                required
                disabled={pending}
                className={inputClass}
              >
                <option value="4">4 hours</option>
                <option value="8">8 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="72">3 days</option>
              </select>
            </Field>
          </div>

          <PermissionGuide />
        </div>

        <div
          aria-live="polite"
          className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-h-5">
            {state.message ? (
              <p
                className={`text-sm ${
                  state.success ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {state.message}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                The raw scanner token is never stored.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Creating…" : "Create scanner link"}
          </button>
        </div>
      </form>

      {state.scannerUrl ? (
        <section className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-300">
            Scanner link created
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Copy this link now
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            For security, TourniBase stores only a hash and cannot show this
            exact link again after you leave or refresh this page.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="break-all font-mono text-xs leading-6 text-emerald-200">
              {state.scannerUrl}
            </p>
          </div>
          <button
            type="button"
            onClick={copyScannerLink}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            {copyLabel}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  children,
  error,
  help,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  help?: string;
  htmlFor?: string;
  label: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-200"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-sm text-red-300">{error}</p>
      ) : help ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{help}</p>
      ) : null}
    </div>
  );
}

function PermissionGuide() {
  return (
    <div className="rounded-xl border border-border bg-black/10 p-4">
      <p className="text-sm font-medium text-slate-200">Permission guide</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
        <li>
          <span className="text-slate-300">Scan only:</span> validates passes.
        </li>
        <li>
          <span className="text-slate-300">Standard gate:</span> adds manual
          lookup and recent scan history.
        </li>
        <li>
          <span className="text-slate-300">Full gate access:</span> also allows
          recording gate sales.
        </li>
      </ul>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70";

const readOnlyInputClass =
  "h-11 w-full rounded-xl border border-border bg-white/[0.025] px-3 text-sm text-slate-400 outline-none";
