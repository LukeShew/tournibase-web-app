"use client";

import { useState } from "react";

type ShareByTextButtonProps = {
  message: string;
  title: string;
};

export function ShareByTextButton({
  message,
  title,
}: ShareByTextButtonProps) {
  const [label, setLabel] = useState("Share by text");

  async function shareMessage() {
    try {
      if (navigator.share) {
        await navigator.share({
          text: message,
          title,
        });
        return;
      }

      await navigator.clipboard.writeText(message);
      setLabel("Message copied");
      window.location.href = "sms:";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setLabel("Unable to share");
    }
  }

  return (
    <button
      type="button"
      onClick={shareMessage}
      className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}
