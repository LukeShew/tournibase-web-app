"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDirector } from "@/lib/auth";
import { PROFILE_AVATAR_OPTIONS } from "@/lib/profile-avatar-options";
import { createClient } from "@/lib/supabase/server";

const validAvatarIds = new Set(
  PROFILE_AVATAR_OPTIONS.map((option) => option.id),
);

const directorNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120);

export async function updateDirectorName(formData: FormData) {
  const result = directorNameSchema.safeParse(formData.get("name"));

  if (!result.success) {
    redirect("/dashboard/settings?profile=invalid_name");
  }

  await requireDirector();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_director_profile_name", {
    p_name: result.data,
  });

  if (error) {
    console.error("[settings] director name update failed", {
      code: error.code,
    });
    redirect("/dashboard/settings?profile=update_failed");
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?profile=name_updated");
}

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
