"use client";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldId } from "./field";

export type SelectOption = { value: string; label: string; icon?: LucideIcon };

// Radix renders a hidden native <select> under `name`, so it works with FormData.
// Radix reserves "" for "no value": use a real value (e.g. "all") for an "any" option.
export function Select({ options, name, value, defaultValue, onValueChange, placeholder, size = "md", className, required, disabled, "aria-label": ariaLabel }: {
  options: SelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const fieldId = useFieldId();
  return (
    <SelectPrimitive.Root name={name} value={value} defaultValue={defaultValue} onValueChange={onValueChange} required={required} disabled={disabled}>
      <SelectPrimitive.Trigger id={fieldId} aria-label={ariaLabel} className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left outline-none transition-colors",
        "hover:border-white/20 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted",
        size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
        className,
      )}>
        <span className="truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
        <SelectPrimitive.Icon><ChevronDown size={14} className="text-muted" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* z-[60]: above the dialog (z-50) when used inside one */}
        <SelectPrimitive.Content position="popper" sideOffset={4}
          className="z-[60] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface2 p-1 shadow-2xl">
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-sm text-fg/85 outline-none data-[highlighted]:bg-white/5 data-[highlighted]:text-fg data-[state=checked]:text-accent">
                {o.icon && <o.icon size={14} aria-hidden className="shrink-0" />}
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2"><Check size={14} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
