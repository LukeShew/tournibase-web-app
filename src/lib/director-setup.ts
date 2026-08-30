import "server-only";

import type { AppEnvironment } from "@/lib/app-environment";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DirectorSetupInput = {
  allowOrganizationCreation: boolean;
  email: string;
  environment: AppEnvironment;
  name: string;
  organizationName: string;
  userId: string;
};

/**
 * Makes the director profile and first organization safe to retry. Auth users
 * are deliberately never deleted when this setup has a transient failure.
 */
export async function ensureDirectorSetup({
  allowOrganizationCreation,
  email,
  environment,
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
    { ignoreDuplicates: true, onConflict: "id" },
  );

  if (profileError) {
    return { error: profileError };
  }

  const { data: existingOrganizations, error: organizationLookupError } =
    await admin
      .from("organizations")
      .select("id, operating_environment")
      .eq("owner_user_id", userId)
      .limit(2);

  if (organizationLookupError) {
    return { error: organizationLookupError };
  }

  if ((existingOrganizations ?? []).length > 1) {
    return {
      error: new Error("The director account has more than one organization."),
    };
  }

  const existingOrganization = existingOrganizations?.[0];

  if (existingOrganization) {
    if (existingOrganization.operating_environment !== environment) {
      return {
        error: new Error(
          "The director organization belongs to a different application environment.",
        ),
      };
    }

    return { error: null };
  }

  if (!allowOrganizationCreation) {
    return {
      error: new Error(
        "This application environment does not create director organizations.",
      ),
    };
  }

  const { error: organizationError } = await admin
    .from("organizations")
    .insert({
      name: organizationName,
      operating_environment: environment,
      owner_user_id: userId,
    });

  return { error: organizationError };
}
