"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldId } from "./field";

export const inputClass = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent disabled:opacity-50";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, id, ...props }, ref) => {
    const fieldId = useFieldId();
    return <input ref={ref} id={id ?? fieldId} className={cn(inputClass, className)} {...props} />;
  }
);
Input.displayName = "Input";

// Fixed text inside the field ("R$", "km"), outside the typed value.
export function Affix({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: React.ReactElement<{ className?: string }> }) {
  const affix = "mono pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs text-muted";
  return (
    <div className="relative">
      {prefix && <span className={cn(affix, "left-3")}>{prefix}</span>}
      {React.cloneElement(children, { className: cn(children.props.className, prefix && "pl-9", suffix && "pr-14") })}
      {suffix && <span className={cn(affix, "right-3")}>{suffix}</span>}
    </div>
  );
}
