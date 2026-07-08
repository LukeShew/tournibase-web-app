"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardSidebarProps = {
  director: {
    email: string;
    name: string;
  };
  logoutAction: () => Promise<void>;
};

type NavItem = {
  disabledMessage?: string;
  href?: string;
  icon: string;
  isActive?: boolean;
  label: string;
};

export function DashboardSidebar({
  director,
  logoutAction,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const tournamentId =
    pathname.match(/^\/dashboard\/tournaments\/(\d+)/)?.[1] ?? null;
  const hasSelectedEvent = Boolean(tournamentId);
  const selectEventMessage = "Please select an event first.";

  const eventBaseHref = tournamentId
    ? `/dashboard/tournaments/${tournamentId}`
    : undefined;

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      icon: "⌂",
      isActive: pathname === "/dashboard",
      label: "Home",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref,
      icon: "□",
      isActive: pathname === eventBaseHref,
      label: "Event overview",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/gate` : undefined,
      icon: "⇄",
      isActive: pathname === `${eventBaseHref}/gate`,
      label: "Gate tools",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/orders` : undefined,
      icon: "◷",
      isActive: pathname === `${eventBaseHref}/orders`,
      label: "Orders",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/sales` : undefined,
      icon: "▥",
      isActive: pathname === `${eventBaseHref}/sales`,
      label: "Sales",
    },
  ];

  return (
    <aside className="group/sidebar sticky top-0 z-30 hidden h-screen w-20 flex-col overflow-hidden border-r border-border bg-white/95 px-3 py-4 shadow-sm backdrop-blur-xl transition-[width] duration-200 ease-out hover:w-72 focus-within:w-72 lg:flex">
      <Link
        href="/dashboard"
        className="flex h-11 items-center gap-3 rounded-2xl px-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        aria-label="TourniBase dashboard home"
      >
        <Image
          src="/tournibase-app-icon.svg"
          alt=""
          width={38}
          height={38}
          priority
        />
        <span className="whitespace-nowrap text-lg font-semibold tracking-[-0.025em] text-slate-950 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
          TourniBase
        </span>
      </Link>

      <nav aria-label="Dashboard navigation" className="mt-8 space-y-2">
        {navItems.map((item) => (
          <SidebarNavItem key={item.label} item={item} />
        ))}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="flex items-center gap-3 rounded-3xl bg-card-strong p-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
            {getInitials(director.name)}
          </div>
          <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <p className="truncate text-sm font-semibold text-slate-950">
              {director.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {director.email}
            </p>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-2 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-card-strong hover:text-slate-950"
            aria-label="Sign out"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card-strong text-base">
              ↩
            </span>
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              Sign out
            </span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-2 group-hover/sidebar:grid-cols-2 group-focus-within/sidebar:grid-cols-2">
          <BottomLink href="/dashboard/settings" icon="⚙" label="Settings" />
          <BottomLink href="/support" icon="?" label="Support" />
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const className = item.isActive
    ? "bg-brand-soft text-blue-700"
    : item.disabledMessage
      ? "text-slate-300"
      : "text-slate-500 hover:bg-card-strong hover:text-slate-950";

  if (item.href && !item.disabledMessage) {
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 text-sm font-semibold transition ${className}`}
      >
        <SidebarIcon icon={item.icon} isActive={item.isActive} />
        <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
          {item.label}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left text-sm font-semibold transition ${className}`}
      onClick={() => {
        window.alert(item.disabledMessage ?? "This page is not available yet.");
      }}
    >
      <SidebarIcon icon={item.icon} />
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
        {item.label}
      </span>
    </button>
  );
}

function BottomLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-2xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-card-strong hover:text-slate-950"
      aria-label={label}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-white text-sm shadow-sm">
        {icon}
      </span>
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
        {label}
      </span>
    </Link>
  );
}

function SidebarIcon({
  icon,
  isActive = false,
}: {
  icon: string;
  isActive?: boolean;
}) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border text-base shadow-sm ${
        isActive
          ? "border-blue-100 bg-white text-blue-700"
          : "border-border bg-white text-current"
      }`}
    >
      {icon}
    </span>
  );
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "TB";
}
