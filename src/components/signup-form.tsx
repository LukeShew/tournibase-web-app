"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = { message: "" };

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initialState);

  return (
    <form action={action} className="space-y-4">
      <Field label="Your name" name="name" autoComplete="name" />
      <Field label="Organization" name="organization" autoComplete="organization" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" />
      {state.message ? (
        <p className={`rounded-2xl border px-4 py-3 text-sm font-medium ${state.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</p>
      ) : null}
      <button disabled={pending} className="h-12 w-full rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-60">
        {pending ? "Creating account…" : "Create director account"}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", autoComplete }: { label: string; name: string; type?: string; autoComplete: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input required name={name} type={type} autoComplete={autoComplete} className="mt-2 h-12 w-full rounded-2xl border border-border bg-white px-4 text-slate-950 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>;
}
