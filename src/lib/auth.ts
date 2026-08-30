import { cache } from "react";
import { redirect } from "next/navigation";
import {
  getAppEnvironment,
  type AppEnvironment,
} from "@/lib/app-environment";
import { createClient } from "@/lib/supabase/server";

export type DirectorProfile = {
  avatarId: string;
  id: string;
  name: string;
  email: string;
  role: "director";
};

export type DirectorWorkspace = {
  director: DirectorProfile;
  organization: {
    id: number;
    name: string;
    operatingEnvironment: AppEnvironment;
  };
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

export const getDirectorWorkspace = cache(
  async (): Promise<DirectorWorkspace | null> => {
    const director = await getDirector();

    if (!director) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, operating_environment")
      .eq("owner_user_id", director.id)
      .order("created_at", { ascending: true })
      .limit(2);

    if (error) {
      throw error;
    }

    if ((data ?? []).length !== 1) {
      return null;
    }

    const organization = data![0];
    const operatingEnvironment = organization.operating_environment as
      | AppEnvironment
      | undefined;

    if (operatingEnvironment !== getAppEnvironment()) {
      return null;
    }

    return {
      director,
      organization: {
        id: organization.id as number,
        name: organization.name as string,
        operatingEnvironment,
      },
    };
  },
);

export async function requireDirectorWorkspace() {
  const workspace = await getDirectorWorkspace();

  if (!workspace) {
    redirect("/login?access=unavailable");
  }

  return workspace;
}

export async function requireDirector() {
  const workspace = await requireDirectorWorkspace();

  return workspace.director;
}
