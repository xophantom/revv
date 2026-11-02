import Link from "next/link";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { ConnectionsLink } from "./ConnectionsLink";
import { signOut } from "@/auth";

export function Topbar({ userName }: { userName?: string | null }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        <Link href="/garage" className="shrink-0"><Logo /></Link>
        <NavLinks />
      </div>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <ConnectionsLink />
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} className="min-w-0">
          {/* The name only fits from sm up; on a phone the button is just "sair". */}
          <button type="submit" title={userName ? `Sair (${userName})` : undefined}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
            {userName && (
              <>
                <span className="hidden max-w-48 truncate sm:inline">{userName}</span>
                <span aria-hidden className="hidden sm:inline">·</span>
              </>
            )}
            <span className="shrink-0">sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
