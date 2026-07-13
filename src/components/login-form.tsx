"use client";

import { useActionState, useEffect, useState } from "react";
import {
  login,
  resendSignupConfirmation,
  type LoginState,
} from "@/app/login/actions";
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  getConfirmationResendSecondsRemaining,
} from "@/lib/confirmation-resend";

const initialLoginState: LoginState = {
  message: "",
};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialLoginState);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            className="h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
            placeholder="director@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-70"
            placeholder="Your password"
          />
        </div>

        <div aria-live="polite" className="min-h-6">
          {state.message ? (
            <p className="text-sm text-red-600">{state.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {state.confirmationEmail ? (
        <ConfirmationResendForm email={state.confirmationEmail} />
      ) : null}
    </div>
  );
}

function ConfirmationResendForm({ email }: { email: string }) {
  const [availableAt] = useState(
    () => Date.now() + CONFIRMATION_RESEND_COOLDOWN_SECONDS * 1000,
  );
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getConfirmationResendSecondsRemaining(availableAt),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = getConfirmationResendSecondsRemaining(availableAt);
      setSecondsRemaining(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, [availableAt]);

  return (
    <form action={resendSignupConfirmation}>
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={secondsRemaining > 0}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
      >
        {secondsRemaining > 0
          ? `Resend available in ${secondsRemaining}s`
          : "Resend confirmation email"}
      </button>
    </form>
  );
}
