"use client";

import { useRouter } from "next/navigation";

export function BackNavigationButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push("/");
      }}
    >
      ← Back
    </button>
  );
}
