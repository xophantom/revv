"use client";
import { useCallback, useId, useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string };

// In-app replacement for window.confirm. Render `dialog` once; `await confirm({...})` resolves
// true on confirm, false on cancel, Esc or outside click. Focus starts on "Cancelar".
export function useConfirm() {
  const descriptionId = useId();
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const dialog = (
    <Dialog open={pending != null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <DialogContent role="alertdialog" aria-describedby={pending?.description ? descriptionId : undefined} className="max-w-sm">
        <DialogTitle>{pending?.title}</DialogTitle>
        {pending?.description && <p id={descriptionId} className="mt-2 text-sm text-muted">{pending.description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => settle(false)}>Cancelar</Button>
          <Button onClick={() => settle(true)}>{pending?.confirmLabel ?? "Excluir"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  return [confirm, dialog] as const;
}
