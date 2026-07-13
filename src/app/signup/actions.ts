"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthEmailRedirectUrl } from "@/lib/auth-email-url";
import { ensureDirectorSetup } from "@/lib/director-setup";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getSignupFailureMessage } from "@/lib/signup-errors";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  organization: z.string().trim().min(2, "Enter your organization name.").max(160),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export type SignupState = { message: string; success?: boolean };

export async function signup(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const ip = await getRequestIp();
  const allowed = await checkRateLimit({
    key: `signup:${ip}`,
    limit: 5,
    windowSeconds: 3600,
  });

  if (!allowed) {
    return { message: "Too many signup attempts. Try again later." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    options: {
      data: {
        name: parsed.data.name,
        organization_name: parsed.data.organization,
      },
      emailRedirectTo: getAuthEmailRedirectUrl(),
    },
    password: parsed.data.password,
  });

  if (error || !data.user || data.user.identities?.length === 0) {
    return {
      message: getSignupFailureMessage({
        error,
        identityCreated: Boolean(data.user && data.user.identities?.length !== 0),
      }),
    };
  }

  const { error: setupError } = await ensureDirectorSetup({
    email: parsed.data.email,
    name: parsed.data.name,
    organizationName: parsed.data.organization,
    userId: data.user.id,
  });

  if (setupError) {
    // The user can still confirm their email and sign in. Their profile setup
    // is retried at sign-in instead of deleting a valid new Auth account.
    console.error("Unable to finish director signup setup", setupError);
  }

  if (data.session) {
    await supabase.auth.signOut();
    redirect("/login?created=1");
  }

  redirect("/login?created=1&confirmation=required");
}
