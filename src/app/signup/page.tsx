import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignupForm } from "@/components/signup-form";
import { getDirector } from "@/lib/auth";

export const metadata: Metadata = { title: "Create director account" };

export default async function SignupPage() {
  if (await getDirector()) redirect("/dashboard");

  return <main className="min-h-screen bg-[#f7f8fb] px-6 py-6 text-slate-950 sm:px-10">
    <header className="mx-auto flex max-w-6xl items-center justify-between"><Brand tone="light" /><Link href="/login" className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Sign in</Link></header>
    <section className="mx-auto w-full max-w-lg py-14"><p className="text-sm font-semibold text-blue-700">Get started</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Create your TourniBase account</h1><p className="mt-3 leading-7 text-slate-500">Set up a director account, then create your first admission event.</p><div className="mt-8 rounded-[2rem] border border-border bg-white p-6 shadow-sm"><SignupForm /></div><p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-blue-700">Sign in</Link>.</p></section>
  </main>;
}
