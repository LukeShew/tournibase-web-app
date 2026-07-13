"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthEmailRedirectUrl } from "@/lib/auth-email-url";
import { ensureDirectorSetup } from "@/lib/director-setup";
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
} from "@/lib/confirmation-resend";
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
  email?: string;
  focusPassword?: boolean;
  focusPasswordAt?: number;
};

function hasValidEmail(value: unknown) {
  return z.email().safeParse(value).success;
}

function loginConfirmationUrl(status: string, email?: string) {
  const params = new URLSearchParams({ confirmation: status });
  if (email) params.set("email", email);
  return `/login?${params.toString()}`;
}

function isConfirmationRateLimited(error: {
  code?: string;
  message?: string;
  status?: number;
}) {
  const details = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    error.status === 429 ||
    details.includes("rate limit") ||
    details.includes("over_email_send_rate_limit") ||
    details.includes("only request this after")
  );
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const submittedEmail = formData.get("email");
  const normalizedSubmittedEmail =
    typeof submittedEmail === "string"
      ? submittedEmail.trim().toLowerCase()
      : "";
  const result = loginSchema.safeParse({
    email: submittedEmail,
    password: formData.get("password"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check your email and password.",
      email: normalizedSubmittedEmail || undefined,
      focusPassword: hasValidEmail(normalizedSubmittedEmail),
      focusPasswordAt: Date.now(),
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
      email: result.data.email,
      focusPassword: true,
      focusPasswordAt: Date.now(),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    if (isEmailConfirmationRequired(error)) {
      return {
        message:
          "Confirm your email before signing in. Check your inbox for the confirmation link.",
        confirmationEmail: result.data.email,
        email: result.data.email,
        focusPassword: true,
        focusPasswordAt: Date.now(),
      };
    }

    const admin = getSupabaseAdmin();
    const { data: account, error: lookupError } = await admin
      .from("users")
      .select("id")
      .ilike("email", result.data.email)
      .limit(1)
      .maybeSingle();

    const accountExists = lookupError ? null : Boolean(account);
    return {
      message: getLoginFailureMessage({
        accountExists,
      }),
      email: result.data.email,
      focusPassword: true,
      focusPasswordAt: Date.now(),
    };
  }

  const user = data.user;
  const metadata = user.user_metadata as {
    name?: string;
    organization_name?: string;
  };
  const { error: setupError } = await ensureDirectorSetup({
    email: user.email ?? result.data.email,
    name: metadata.name?.trim() || user.email?.split("@")[0] || "Director",
    organizationName: metadata.organization_name?.trim() || "My organization",
    userId: user.id,
  });

  if (setupError) {
    await supabase.auth.signOut();
    return {
      message:
        "Your account exists, but we could not finish loading it. Try signing in again.",
      email: result.data.email,
      focusPassword: true,
      focusPasswordAt: Date.now(),
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
    redirect(loginConfirmationUrl("resend-error"));
  }

  const ip = await getRequestIp();
  const allowed = await checkRateLimit({
    key: `confirmation:${ip}:${parsed.data}`,
    limit: 1,
    windowSeconds: CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  });

  if (!allowed) {
    redirect(loginConfirmationUrl("resend-limited", parsed.data));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: {
      emailRedirectTo: getAuthEmailRedirectUrl(),
    },
  });

  if (error) {
    redirect(
      loginConfirmationUrl(
        isConfirmationRateLimited(error) ? "resend-limited" : "resend-error",
        parsed.data,
      ),
    );
  }

  redirect(loginConfirmationUrl("resent", parsed.data));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
