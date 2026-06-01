import * as React from "react";
import { cn } from "@/lib/utils";
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn("inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:opacity-50", className)} {...props} />
  )
);
Button.displayName = "Button";
