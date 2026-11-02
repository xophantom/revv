"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/garage", label: "Garagem" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex gap-4 text-sm">
      {LINKS.map(({ href, label }) => {
        // A section stays active on its subpages (/garage/<id>, /garage/<id>/spec/edit).
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative py-1 transition-colors hover:text-fg",
              active ? "text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-muted",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
