import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";
