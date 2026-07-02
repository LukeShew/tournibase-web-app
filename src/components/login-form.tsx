"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login/actions";

const initialLoginState: LoginState = {
  message: "",
};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialLoginState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-slate-200"
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
          className="h-12 w-full rounded-xl border border-border bg-black/20 px-4 text-base text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70"
          placeholder="director@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium text-slate-200"
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
          className="h-12 w-full rounded-xl border border-border bg-black/20 px-4 text-base text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-wait disabled:opacity-70"
          placeholder="Your password"
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        {state.message ? (
          <p className="text-sm text-red-300">{state.message}</p>
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
  );
}
