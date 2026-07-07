import type { Metadata } from "next";
import Link from "next/link";
import { TournamentForm } from "@/components/tournament-form";
import { requireDirector } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create admission event",
};

export default async function NewTournamentPage() {
  const director = await requireDirector();

  return (
    <div className="pb-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to events
      </Link>

      <div className="mt-6 max-w-3xl">
        <p className="text-sm font-semibold text-blue-700">New admission event</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
          Set up your tournament
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-400">
          Add the information parents and gate staff need. Your event starts as
          a private draft.
        </p>
      </div>

      <TournamentForm
        defaultContactEmail={director.email}
        defaultOrganizerName={director.name}
      />
    </div>
  );
}
