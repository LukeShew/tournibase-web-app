"use client";

import { useEffect, useRef, useState } from "react";

type CopyTextButtonProps = {
  label: string;
  text: string;
  tone?: "primary" | "secondary";
};

export function CopyTextButton({
  label,
  text,
  tone = "primary",
}: CopyTextButtonProps) {
  const [buttonLabel, setButtonLabel] = useState(label);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  function showTemporaryLabel(nextLabel: string) {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }

    setButtonLabel(nextLabel);
    resetTimer.current = window.setTimeout(() => setButtonLabel(label), 1800);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      showTemporaryLabel("Copied");
    } catch {
      showTemporaryLabel("Copy failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copyText}
      className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
        tone === "primary"
          ? "bg-brand-strong text-white hover:bg-blue-500"
          : "border border-border bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span aria-live="polite">{buttonLabel}</span>
    </button>
  );
}
