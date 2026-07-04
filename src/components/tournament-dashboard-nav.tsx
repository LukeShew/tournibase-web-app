import Link from "next/link";

type TournamentDashboardNavProps = {
  active: "overview" | "sales" | "scans";
  tournamentId: number;
};

const items = [
  { key: "overview", label: "Overview", segment: "" },
  { key: "sales", label: "Sales", segment: "/sales" },
  { key: "scans", label: "Gate activity", segment: "/scans" },
] as const;

export function TournamentDashboardNav({
  active,
  tournamentId,
}: TournamentDashboardNavProps) {
  return (
    <nav
      aria-label="Tournament dashboard"
      className="mt-6 flex gap-2 overflow-x-auto border-b border-border"
    >
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={`/dashboard/tournaments/${tournamentId}${item.segment}`}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
              isActive
                ? "border-blue-400 text-blue-200"
                : "border-transparent text-slate-500 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
