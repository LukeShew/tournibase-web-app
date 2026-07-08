import type { Metadata } from "next";
import Link from "next/link";
import { requireDirector } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const director = await requireDirector();

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <p className="text-sm font-semibold text-blue-700">Director settings</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
        Settings
      </h1>
      <p className="mt-3 max-w-2xl text-slate-500">
        Account and support details for your TourniBase director workspace.
      </p>

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-card-strong px-6 py-5">
          <h2 className="font-semibold text-slate-950">Account</h2>
          <p className="mt-1 text-sm text-slate-500">
            This is the director account currently signed in.
          </p>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          <SettingsItem label="Name" value={director.name} />
          <SettingsItem label="Email" value={director.email} />
        </dl>
      </section>

      <section className="mt-6 rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950">Support</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the support page for refund policy questions, event setup issues,
          or problems with passes and scanner access.
        </p>
        <Link
          href="/support"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          Open support
        </Link>
      </section>
    </div>
  );
}

function SettingsItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-6 py-5">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
