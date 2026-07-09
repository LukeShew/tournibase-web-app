"use client";

import { useState } from "react";

export function EditableCoachMessage({
  initialMessage,
}: {
  initialMessage: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [copyState, setCopyState] = useState<"copied" | "idle" | "failed">(
    "idle",
  );

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div>
      <label htmlFor="coach-message" className="sr-only">
        Coach message
      </label>
      <textarea
        id="coach-message"
        className="min-h-44 w-full resize-y rounded-2xl border border-border bg-white p-5 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setCopyState("idle");
        }}
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
          onClick={copyMessage}
        >
          Copy coach message
        </button>
        {copyState === "copied" ? (
          <p className="text-sm text-emerald-700">Copied.</p>
        ) : copyState === "failed" ? (
          <p className="text-sm text-red-600">
            Copy failed. Select the message and copy it manually.
          </p>
        ) : null}
      </div>
    </div>
  );
}
