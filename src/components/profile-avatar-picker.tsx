"use client";

import { ProfileAvatarIcon } from "@/components/profile-avatar-icon";
import { useProfileAvatarId } from "@/hooks/use-profile-avatar-id";
import {
  getProfileAvatarOption,
  PROFILE_AVATAR_OPTIONS,
  PROFILE_AVATAR_STORAGE_KEY,
} from "@/lib/profile-avatar-options";

export function ProfileAvatarPicker() {
  const selectedId = useProfileAvatarId();
  const selectedOption = getProfileAvatarOption(selectedId);

  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-card-strong px-6 py-5">
        <h2 className="font-semibold text-slate-950">Profile icon</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose a preset icon and color for this browser. Uploads are disabled
          for now.
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
            This updates the sidebar on this device.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PROFILE_AVATAR_OPTIONS.map((option) => {
            const isSelected = option.id === selectedId;

            return (
              <button
                key={option.id}
                type="button"
                className={`flex items-center gap-3 rounded-3xl border p-3 text-left transition ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-border bg-white hover:border-blue-200 hover:bg-blue-50/60"
                }`}
                onClick={() => {
                  window.localStorage.setItem(
                    PROFILE_AVATAR_STORAGE_KEY,
                    option.id,
                  );
                  window.dispatchEvent(new Event("tournibase-profile-avatar"));
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
      </div>
    </section>
  );
}
