import Link from "next/link";
import { Logo } from "./Logo";
import { signOut } from "@/auth";

export function Topbar({ userName }: { userName?: string | null }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/garage"><Logo /></Link>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/garage" className="hover:text-fg">Garagem</Link>
          <Link href="/dashboard" className="hover:text-fg">Dashboard</Link>
        </nav>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button className="text-sm text-muted hover:text-fg">{userName ?? "Sair"} · sair</button>
      </form>
    </header>
  );
}
