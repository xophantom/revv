import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

// notFound() from a vehicle page: the id doesn't exist or belongs to someone else.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="mono text-xs uppercase tracking-widest text-accent">{"// 404"}</p>
      <h1 className="mt-2 text-2xl font-bold">Não encontrado</h1>
      <p className="mt-2 text-sm text-muted">Esta página não existe ou o veículo não está na sua garagem.</p>
      <Link href="/garage" className={buttonClass({ className: "mt-6" })}>← Voltar para a garagem</Link>
    </div>
  );
}
