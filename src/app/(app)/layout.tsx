import { requireUser } from "@/lib/session";
import { Topbar } from "@/components/shell/Topbar";
import { Toaster } from "@/components/ui/sonner";
import { Lightbox } from "@/components/gallery/Lightbox";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Topbar userName={user.name ?? user.email} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <Lightbox />
      <Toaster />
    </div>
  );
}
