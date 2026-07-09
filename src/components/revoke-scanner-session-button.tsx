"use client";

import { useActionState } from "react";
import { revokeScannerSession } from "@/app/dashboard/tournaments/[id]/gate/actions";
import { initialRevokeScannerSessionState } from "@/lib/form-states";

export function RevokeScannerSessionButton({
  scannerSessionId,
  tournamentId,
}: {
  scannerSessionId: number;
  tournamentId: number;
}) {
  const revokeThisSession = revokeScannerSession.bind(
    null,
    tournamentId,
    scannerSessionId,
  );
  const [actionState, action, pending] = useActionState(
    revokeThisSession,
    initialRevokeScannerSessionState,
  );
  const state = actionState ?? initialRevokeScannerSessionState;

  return (
    <div>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          onClick={(event) => {
            if (
              !window.confirm(
                "Revoke this scanner link? Gate staff will immediately lose access.",
              )
            ) {
              event.preventDefault();
            }
          }}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Revoking…" : "Revoke link"}
        </button>
      </form>
      {state.message && !state.success ? (
        <p aria-live="polite" className="mt-2 text-xs text-red-300">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
