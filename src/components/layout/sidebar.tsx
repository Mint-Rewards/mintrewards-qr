"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  QrCode,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Persistent primary navigation.
 *
 * Four destinations, always visible, never nested. The operator runs this while
 * coordinating field staff on the phone, so every section stays exactly one click away
 * rather than being tucked behind a menu.
 */
const NAV: { href: string; label: string; icon: LucideIcon; hint: string }[] = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, hint: "Scan activity at a glance" },
  { href: "/team-members", label: "Team Members", icon: Users,           hint: "Field onboarding staff" },
  { href: "/assignments",  label: "Assignments",  icon: QrCode,          hint: "Standees and QR codes" },
  { href: "/scans",        label: "Scan Events",  icon: ScanLine,        hint: "Raw scan log and export" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon, hint }) => {
        // Prefix match so detail pages keep their section highlighted.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={hint}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
