"use client";

import { useSyncExternalStore } from "react";
import {
  PROFILE_AVATAR_OPTIONS,
  PROFILE_AVATAR_STORAGE_KEY,
} from "@/lib/profile-avatar-options";

const defaultAvatarId = PROFILE_AVATAR_OPTIONS[0].id;

export function useProfileAvatarId() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribe(callback: () => void) {
  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener("tournibase-profile-avatar", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("tournibase-profile-avatar", handleChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) ?? defaultAvatarId;
}

function getServerSnapshot() {
  return defaultAvatarId;
}
