"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldId } from "./field";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, ...props }, ref) => {
    const fieldId = useFieldId();
    return <textarea ref={ref} id={id ?? fieldId} className={cn("min-h-20 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent", className)} {...props} />;
  }
);
Textarea.displayName = "Textarea";
