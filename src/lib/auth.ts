import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type DirectorProfile = {
  avatarId: string;
  id: string;
  name: string;
  email: string;
  role: "director";
};

export const getDirector = cache(async (): Promise<DirectorProfile | null> => {
  const supabase = await createClient();
  const { data: claimData, error: claimError } =
    await supabase.auth.getClaims();
  const userId = claimData?.claims?.sub;

  if (claimError || !userId) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, name, email, role, avatar_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "director") {
    return null;
  }

  return {
    avatarId: profile.avatar_id,
    email: profile.email,
    id: profile.id,
    name: profile.name,
    role: profile.role,
  } as DirectorProfile;
});

export async function requireDirector() {
  const director = await getDirector();

  if (!director) {
    redirect("/login");
  }

  return director;
}
