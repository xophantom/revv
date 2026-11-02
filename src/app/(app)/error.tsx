"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";

// unstable_retry re-fetches the segment's server data before re-rendering; a plain reset() would
// re-render the same failed payload, and nearly every error here comes from the server.
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <p className="mono text-xs uppercase tracking-widest text-accent">{"// erro"}</p>
      <h1 className="mt-2 text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-muted">Não conseguimos carregar esta página. Tente de novo; se continuar, volte daqui a pouco.</p>
      {error.digest && <p className="mono mt-3 text-[11px] text-muted">ref {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => unstable_retry()}><RotateCcw size={15} aria-hidden /> Tentar de novo</Button>
        <Link href="/garage" className={buttonClass({ variant: "outline" })}>Ir para a garagem</Link>
      </div>
    </div>
  );
}
