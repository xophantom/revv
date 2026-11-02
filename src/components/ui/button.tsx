import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-accent font-semibold text-bg hover:bg-accent/85",
  outline: "border border-border text-fg hover:border-white/25 hover:bg-white/[.03]",
  ghost: "text-muted hover:bg-white/5 hover:text-fg",
  danger: "text-muted hover:bg-accent/10 hover:text-accent",
} as const;

const SIZES = {
  md: "h-10 gap-2 px-4 text-sm",
  sm: "h-8 gap-1.5 px-3 text-xs",
  icon: "h-8 w-8",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

// Also styles links that look like buttons (<a>, <Link>).
export function buttonClass({ variant = "primary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant], SIZES[size], className,
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

// type defaults to "button": a submit has to be asked for.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass({ variant, size, className })} {...props} />
  )
);
Button.displayName = "Button";
