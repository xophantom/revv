"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn("transition disabled:cursor-wait disabled:opacity-60", className)}>
      {pending ? pendingText : children}
    </button>
  );
}
