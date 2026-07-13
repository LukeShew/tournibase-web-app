import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DirectorSetupInput = {
  email: string;
  name: string;
  organizationName: string;
  userId: string;
};

/**
 * Makes the director profile and first organization safe to retry. Auth users
 * are deliberately never deleted when this setup has a transient failure.
 */
export async function ensureDirectorSetup({
  email,
  name,
  organizationName,
  userId,
}: DirectorSetupInput) {
  const admin = getSupabaseAdmin();

  const { error: profileError } = await admin.from("users").upsert(
    {
      email,
      id: userId,
      name,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { error: profileError };
  }

  const { data: existingOrganization, error: organizationLookupError } =
    await admin
      .from("organizations")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1)
      .maybeSingle();

  if (organizationLookupError) {
    return { error: organizationLookupError };
  }

  if (existingOrganization) {
    return { error: null };
  }

  const { error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: organizationName,
      owner_user_id: userId,
    });

  return { error: organizationError };
}
