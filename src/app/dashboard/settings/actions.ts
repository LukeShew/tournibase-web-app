"use server";

import { revalidatePath } from "next/cache";
import { requireDirector } from "@/lib/auth";
import { PROFILE_AVATAR_OPTIONS } from "@/lib/profile-avatar-options";
import { createClient } from "@/lib/supabase/server";

const validAvatarIds = new Set(
  PROFILE_AVATAR_OPTIONS.map((option) => option.id),
);

export async function updateProfileAvatar(avatarId: string) {
  if (!validAvatarIds.has(avatarId)) {
    return { message: "Choose a valid profile icon.", success: false };
  }

  const director = await requireDirector();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ avatar_id: avatarId })
    .eq("id", director.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { message: "We could not update your profile icon.", success: false };
  }

  revalidatePath("/dashboard", "layout");

  return { message: "Profile icon updated.", success: true };
}
