import { cn } from "@/lib/utils";

// Image button that opens the lightbox. A real <img> (not a CSS background) so offscreen
// thumbs load lazily and decode off the main thread. Callers set size, radius and hover.
export function Thumb({ src, label, onClick, className }: { src: string; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "block shrink-0 cursor-pointer overflow-hidden border border-border bg-surface2 transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated route: next/image's optimizer can't send the session */}
      <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
    </button>
  );
}
