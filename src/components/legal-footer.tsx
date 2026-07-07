"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/support", label: "Support" },
];

export function LegalFooter() {
  const pathname = usePathname();
  const hideForPrefixes = [
    "/dashboard",
    "/dev",
    "/order",
    "/p/",
    "/print",
    "/scan",
  ];
  const shouldHide = hideForPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (shouldHide) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} TourniBase. Digital admission tools.</p>
        <nav aria-label="Legal and support links" className="flex flex-wrap gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-slate-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
