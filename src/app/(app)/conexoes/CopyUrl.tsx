"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyUrl({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Não deu para copiar. Selecione a URL e copie à mão.");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg/60 py-1.5 pl-3 pr-1.5">
      {/* Wraps instead of truncating: the whole URL has to be readable on a phone. */}
      <code className="min-w-0 flex-1 select-all break-all font-mono text-[13px]">{value}</code>
      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span aria-live="polite">{copied ? "Copiada" : "Copiar"}</span>
      </Button>
    </div>
  );
}
