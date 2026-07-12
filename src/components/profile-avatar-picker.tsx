"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfileAvatar } from "@/app/dashboard/settings/actions";
import { ProfileAvatarIcon } from "@/components/profile-avatar-icon";
import {
  getProfileAvatarOption,
  PROFILE_AVATAR_OPTIONS,
} from "@/lib/profile-avatar-options";

export function ProfileAvatarPicker({
  initialAvatarId,
}: {
  initialAvatarId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialAvatarId);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedOption = getProfileAvatarOption(selectedId);

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-card-strong px-6 py-5">
        <h2 className="font-semibold text-slate-950">Profile icon</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose an icon and color for your profile.
        </p>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-3xl bg-card-strong p-6 text-center">
          <div
            className={`grid h-24 w-24 place-items-center rounded-[2rem] shadow-sm ${selectedOption.bgClass} ${selectedOption.textClass}`}
          >
            <ProfileAvatarIcon className="h-12 w-12" icon={selectedOption.icon} />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-950">
            {selectedOption.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Your choice stays with your account on every device.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PROFILE_AVATAR_OPTIONS.map((option) => {
            const isSelected = option.id === selectedId;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isPending}
                className={`flex items-center gap-3 rounded-3xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-60 ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-border bg-white hover:border-blue-200 hover:bg-blue-50/60"
                }`}
                onClick={() => {
                  startTransition(async () => {
                    setMessage(null);
                    const result = await updateProfileAvatar(option.id);

                    if (!result.success) {
                      setMessage(result.message);
                      return;
                    }

                    setSelectedId(option.id);
                    setMessage("Profile icon updated.");
                    router.refresh();
                  });
                }}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${option.bgClass} ${option.textClass}`}
                >
                  <ProfileAvatarIcon icon={option.icon} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {isSelected ? "Selected" : "Use icon"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {message ? (
          <p
            className={`text-sm font-medium lg:col-start-2 ${
              message === "Profile icon updated."
                ? "text-emerald-700"
                : "text-red-700"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
