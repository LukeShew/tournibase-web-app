"use client";

import { useEffect, useRef, useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [label, setLabel] = useState("Copy ticket link");
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

    setLabel(nextLabel);
    resetTimer.current = window.setTimeout(
      () => setLabel("Copy ticket link"),
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
      {label}
    </button>
  );
}
