import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-sm rounded-2xl p-8 text-center">
        <div className="mb-2 text-4xl font-bold tracking-tight">RE<span className="text-accent">VV</span></div>
        <p className="mb-8 text-xs text-muted">Sua garagem, sob controle</p>
        <h1 className="mb-3 text-xl font-bold">Confira seu e-mail</h1>
        <p className="text-sm text-muted">Enviamos um link de acesso para o seu e-mail. Clique nele para entrar. Se não aparecer em alguns minutos, olhe a caixa de spam.</p>
        <Link href="/login" className="tabular-nums mt-8 inline-block text-xs text-accent transition hover:opacity-80">← voltar para o login</Link>
      </div>
    </div>
  );
}
