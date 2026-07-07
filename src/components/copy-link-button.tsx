"use client";

import { useEffect, useRef, useState } from "react";

export function CopyLinkButton({
  label = "Copy ticket link",
  path,
}: {
  label?: string;
  path: string;
}) {
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
    resetTimer.current = window.setTimeout(
      () => setButtonLabel(label),
      1800,
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      showTemporaryLabel("Copied");
    } catch {
      showTemporaryLabel("Copy failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
    >
      {buttonLabel}
    </button>
  );
}
