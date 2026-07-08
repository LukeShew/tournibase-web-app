"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ProfileAvatarIcon } from "@/components/profile-avatar-icon";
import { useProfileAvatarId } from "@/hooks/use-profile-avatar-id";
import {
  getProfileAvatarOption,
} from "@/lib/profile-avatar-options";

type DashboardSidebarProps = {
  director: {
    email: string;
    name: string;
  };
  logoutAction: () => Promise<void>;
};

type IconName =
  | "details"
  | "dollar"
  | "event"
  | "home"
  | "orders"
  | "overview"
  | "settings"
  | "signOut"
  | "support"
  | "wrench";

type NavItem = {
  disabledMessage?: string;
  href?: string;
  icon: IconName;
  isActive?: boolean;
  label: string;
};

export function DashboardSidebar({
  director,
  logoutAction,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const avatarId = useProfileAvatarId();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
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
      icon: "home",
      isActive: pathname === "/dashboard",
      label: "Home",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref,
      icon: "overview",
      isActive: pathname === eventBaseHref,
      label: "Event overview",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/gate` : undefined,
      icon: "wrench",
      isActive: pathname === `${eventBaseHref}/gate`,
      label: "Gate tools",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/orders` : undefined,
      icon: "orders",
      isActive: pathname === `${eventBaseHref}/orders`,
      label: "Orders",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/sales` : undefined,
      icon: "dollar",
      isActive: pathname === `${eventBaseHref}/sales`,
      label: "Sales",
    },
    {
      disabledMessage: hasSelectedEvent ? undefined : selectEventMessage,
      href: eventBaseHref ? `${eventBaseHref}/edit` : undefined,
      icon: "details",
      isActive: pathname === `${eventBaseHref}/edit`,
      label: "Event details",
    },
  ];
  const selectedAvatar = getProfileAvatarOption(avatarId);

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
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${selectedAvatar.bgClass} ${selectedAvatar.textClass}`}
          >
            <ProfileAvatarIcon icon={selectedAvatar.icon} />
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

        {confirmingSignOut ? (
          <div className="rounded-2xl border border-border bg-white p-2 shadow-sm">
            <p className="hidden px-2 pb-2 text-xs font-medium text-slate-500 group-hover/sidebar:block group-focus-within/sidebar:block">
              Sign out of this director account?
            </p>
            <div className="grid gap-2 group-hover/sidebar:grid-cols-2 group-focus-within/sidebar:grid-cols-2">
              <button
                type="button"
                className="flex h-10 items-center justify-center rounded-xl bg-card-strong px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
                onClick={() => setConfirmingSignOut(false)}
              >
                Cancel
              </button>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-2 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-card-strong hover:text-slate-950"
            aria-label="Sign out"
            onClick={() => setConfirmingSignOut(true)}
          >
            <SidebarIcon icon="signOut" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              Sign out
            </span>
          </button>
        )}

        <div className="grid grid-cols-1 gap-2 group-hover/sidebar:grid-cols-2 group-focus-within/sidebar:grid-cols-2">
          <BottomLink href="/dashboard/settings" icon="settings" label="Settings" />
          <BottomLink href="/support" icon="support" label="Support" />
        </div>
      </div>
    </aside>
  );
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const className = item.isActive
    ? "bg-brand-soft text-blue-700"
    : item.disabledMessage
      ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-300 opacity-70"
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
      <SidebarIcon icon={item.icon} isDisabled={Boolean(item.disabledMessage)} />
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
  icon: IconName;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-2xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-card-strong hover:text-slate-950"
      aria-label={label}
    >
      <SidebarIcon icon={icon} size="sm" />
      <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
        {label}
      </span>
    </Link>
  );
}

function SidebarIcon({
  icon,
  isActive = false,
  isDisabled = false,
  size = "md",
}: {
  icon: IconName;
  isActive?: boolean;
  isDisabled?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl border shadow-sm ${
        size === "sm" ? "h-8 w-8 rounded-xl" : "h-9 w-9"
      } ${
        isActive
          ? "border-blue-100 bg-white text-blue-700"
          : isDisabled
            ? "border-slate-200 bg-slate-100 text-slate-300"
            : "border-border bg-white text-current"
      }`}
    >
      <NavIcon icon={icon} />
    </span>
  );
}

function NavIcon({ icon }: { icon: IconName }) {
  const className = "h-4 w-4";

  if (icon === "overview") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 16.5 9.5 11l4 4L20 7.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
        <path
          d="M15 7.5h5v5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
        />
      </svg>
    );
  }

  if (icon === "wrench") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M14.5 6.2a5 5 0 0 0 6 6L12 20.7a3 3 0 0 1-4.2-4.2l8.5-8.5a5 5 0 0 1-1.8-1.8Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "orders") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M6 3.5h12v17l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2v-17Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (icon === "dollar") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 3v18M16.5 7.2A4.8 4.8 0 0 0 12.6 6C10.1 6 8.5 7.1 8.5 8.9c0 3.6 8 1.7 8 6.2 0 1.9-1.7 3.1-4.2 3.1a6 6 0 0 1-4.8-2.1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "details") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 5h14v14H5V5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (icon === "settings") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M19 12a7.3 7.3 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3a7 7 0 0 0-1.7 1L5 6 3 9.4 5.1 11a7.3 7.3 0 0 0 0 2L3 14.6 5 18l2.4-1a7 7 0 0 0 1.7 1l.4 3h5l.4-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6c.1-.3.1-.7.1-1Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  if (icon === "support") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
        <path d="M9.8 9.2a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.3.9-1.3 2v.4M12 17.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (icon === "signOut") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path d="M9 5H5v14h4M13 8l4 4-4 4M17 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 11.5 12 5l7 6.5V20H5v-8.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9.5 20v-5h5v5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
