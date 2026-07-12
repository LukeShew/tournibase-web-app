"use client";

import { useActionState } from "react";
import { sendSupportRequest, type SupportState } from "@/app/support/actions";

export function SupportForm() {
  const [state, action, pending] = useActionState(sendSupportRequest, { message: "" } as SupportState);
  return <form action={action} className="mt-5 grid gap-4">
    <label className="text-sm font-semibold text-slate-700">Name<input required name="name" autoComplete="name" className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
    <label className="text-sm font-semibold text-slate-700">Email<input required name="email" type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-2xl border border-border bg-white px-4 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
    <label className="text-sm font-semibold text-slate-700">How can we help?<textarea required name="message" rows={5} className="mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
    {state.message ? <p className={`rounded-2xl border px-4 py-3 text-sm font-medium ${state.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</p> : null}
    <button disabled={pending} className="h-11 rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Sending…" : "Send message"}</button>
  </form>;
}
