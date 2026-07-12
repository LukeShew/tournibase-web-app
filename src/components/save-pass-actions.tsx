"use client";

import { useState } from "react";

type SavePassActionsProps = {
  downloadPath: string;
  filename: string;
  imagePath: string;
};

export function SavePassActions({
  downloadPath,
  filename,
  imagePath,
}: SavePassActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  async function handleSaveImage() {
    setMessage(null);
    setSharing(true);

    try {
      if (!("share" in navigator) || !("canShare" in navigator)) {
        setMessage("Your browser does not support the save sheet.");
        return;
      }

      const response = await fetch(imagePath);

      if (!response.ok) {
        throw new Error("Pass image could not be loaded.");
      }

      const blob = await response.blob();
      const file = new File([blob], filename, { type: "image/png" });
      const shareData = {
        files: [file],
        title: "TourniBase pass",
      };

      if (!navigator.canShare(shareData)) {
        setMessage("Your browser cannot save this image directly.");
        return;
      }

      await navigator.share(shareData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "The save sheet could not open.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        onClick={handleSaveImage}
        disabled={sharing}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-wait disabled:opacity-70"
      >
        {sharing ? "Opening…" : "Save to photos"}
      </button>
      <a
        href={downloadPath}
        download={filename}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-blue-400/30 bg-blue-400/10 px-5 text-sm font-semibold text-blue-200 transition hover:bg-blue-400/15"
      >
        Download file
      </a>
      {message ? (
        <p className="text-center text-sm leading-6 text-slate-400">
          {message} Touch and hold the pass image above to save it to Photos,
          or use Download file.
        </p>
      ) : null}
    </div>
  );
}
