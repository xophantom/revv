"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plug } from "lucide-react";
import { cn } from "@/lib/utils";

// Next to "sair": icon only on a phone, where the main nav already fills the bar.
export function ConnectionsLink() {
  const active = usePathname().startsWith("/conexoes");
  return (
    <Link
      href="/conexoes"
      title="Conexões"
      aria-current={active ? "page" : undefined}
      className={cn("flex shrink-0 items-center gap-1.5 text-sm transition-colors hover:text-fg", active ? "text-fg" : "text-muted")}
    >
      <Plug size={15} aria-hidden className={cn(active && "text-accent")} />
      <span className="sr-only sm:not-sr-only">Conexões</span>
    </Link>
  );
}
