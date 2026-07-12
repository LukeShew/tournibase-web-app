"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthEmailRedirectUrl } from "@/lib/auth-email-url";
import {
  getLoginFailureMessage,
  isEmailConfirmationRequired,
} from "@/lib/login-errors";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password is too long."),
});

export type LoginState = {
  message: string;
  confirmationEmail?: string;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check your email and password.",
    };
  }

  const ip = await getRequestIp();
  const allowed = await checkRateLimit({
    key: `login:${ip}:${result.data.email}`,
    limit: 10,
    windowSeconds: 900,
  });

  if (!allowed) {
    return {
      message: "Too many sign-in attempts. Try again in a few minutes.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    if (isEmailConfirmationRequired(error)) {
      return {
        message:
          "Confirm your email before signing in. Check your inbox for the confirmation link.",
        confirmationEmail: result.data.email,
      };
    }

    const admin = getSupabaseAdmin();
    const { data: account, error: lookupError } = await admin
      .from("users")
      .select("id")
      .ilike("email", result.data.email)
      .limit(1)
      .maybeSingle();

    return {
      message: getLoginFailureMessage({
        accountExists: lookupError ? null : Boolean(account),
      }),
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendSignupConfirmation(formData: FormData) {
  const parsed = z
    .email()
    .trim()
    .toLowerCase()
    .safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect("/login?confirmation=resend-error");
  }

  const ip = await getRequestIp();
  const allowed = await checkRateLimit({
    key: `confirmation:${ip}:${parsed.data}`,
    limit: 3,
    windowSeconds: 3600,
  });

  if (!allowed) {
    redirect("/login?confirmation=resend-limited");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: {
      emailRedirectTo: getAuthEmailRedirectUrl(),
    },
  });

  redirect(
    error
      ? "/login?confirmation=resend-error"
      : "/login?confirmation=resent",
  );
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
