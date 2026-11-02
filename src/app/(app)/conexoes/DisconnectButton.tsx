"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { disconnectGrant } from "./actions";

export function DisconnectButton({ grantId, name }: { grantId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  async function onDisconnect() {
    const ok = await confirm({
      title: `Desconectar ${name}?`,
      description: "O app perde o acesso à sua garagem na hora. Para usar de novo, conecte outra vez pelo próprio app.",
      confirmLabel: "Desconectar",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await disconnectGrant(grantId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${name} desconectado`);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={onDisconnect} disabled={pending} className="hover:border-accent/60 hover:text-accent">
        <Unplug size={13} /> {pending ? "Desconectando..." : "Desconectar"}
      </Button>
      {confirmDialog}
    </>
  );
}
