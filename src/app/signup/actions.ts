"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
      data: { name: parsed.data.name },
      emailRedirectTo: `${getSiteUrl()}/login`,
    },
    password: parsed.data.password,
  });

  if (error || !data.user || data.user.identities?.length === 0) {
    return { message: "An account with that email may already exist. Try signing in." };
  }

  const admin = getSupabaseAdmin();
  const { error: profileError } = await admin.from("users").update({
    name: parsed.data.name,
  }).eq("id", data.user.id);
  const { error: organizationError } = profileError
    ? { error: null }
    : await admin.from("organizations").insert({
        name: parsed.data.organization,
        owner_user_id: data.user.id,
      });

  if (profileError || organizationError) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return { message: "The account could not be created. Try again." };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    message: "Check your email to confirm your account, then sign in.",
    success: true,
  };
}
