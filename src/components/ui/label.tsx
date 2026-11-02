import { cn } from "@/lib/utils";
export const labelClass = "mb-1 block text-xs text-muted";
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn(labelClass, className)} {...props} />;
}
