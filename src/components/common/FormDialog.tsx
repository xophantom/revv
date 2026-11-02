"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type FormDialogApi = { close: () => void; setBusy: (busy: boolean) => void };

// Create/edit dialog. The body mounts fresh on every open (Radix unmounts closed content), so it
// never shows a previous attempt's state. While busy, Esc/outside click/✕ can't close it mid-save.
// Uncontrolled through `trigger`, or controlled through `open`/`onOpenChange`.
export function FormDialog({ title, trigger, open: openProp, onOpenChange, children }: {
  title: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: (api: FormDialogApi) => React.ReactNode;
}) {
  const [openState, setOpenState] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = openProp ?? openState;

  function setOpen(next: boolean) {
    setOpenState(next);
    onOpenChange?.(next);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || !busy) && setOpen(next)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="glass" onOpenAutoFocus={(e) => {
        // Start on the first field, not on ✕ (Radix focuses the first tabbable element). Skips the
        // hidden inputs behind masked fields and Radix Select.
        const field = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("input:not([type=file]):not([type=hidden]):not([aria-hidden]), textarea");
        if (field) { e.preventDefault(); field.focus(); }
      }}>
        <DialogHeader className="flex items-center justify-between gap-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose disabled={busy} aria-label="Fechar" className="cursor-pointer text-muted transition hover:text-fg disabled:opacity-50">
            <X size={18} />
          </DialogClose>
        </DialogHeader>
        {children({ close: () => { setBusy(false); setOpen(false); }, setBusy })}
      </DialogContent>
    </Dialog>
  );
}
