"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { allowAccess, denyAccess } from "./actions";

const noSubscribe = () => () => {};
const isTopLevel = () => window.top === window.self;
// How long the page must be visible and focused before Permitir works.
const ARM_DELAY_MS = 700;

// Permitir only works once the page has been in front of the user for a moment: a page that opens this
// one and asks for a double click can't land the second click on it (double-clickjacking).
function useArmed() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      setArmed(false);
      if (document.visibilityState === "visible" && document.hasFocus()) timer = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
    };
    update();
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return armed;
}

// Hidden until the page knows it isn't inside a frame: a framed consent screen can be clickjacked.
export function ConsentButtons() {
  const { pending } = useFormStatus();
  const topLevel = useSyncExternalStore(noSubscribe, isTopLevel, () => false);
  const armed = useArmed();
  const disabled = pending || !topLevel;
  return (
    <div className={cn("grid grid-cols-2 gap-3", !topLevel && "invisible")} aria-busy={pending}>
      {/* First in the form, so it's the implicit default. */}
      <button type="submit" formAction={denyAccess} disabled={disabled}
        className="cursor-pointer rounded-lg border border-border py-3 text-sm font-semibold transition hover:border-white/25 hover:bg-white/[.03] disabled:cursor-wait disabled:opacity-60">
        Negar
      </button>
      <button type="submit" formAction={allowAccess} disabled={disabled || !armed}
        className="cursor-pointer rounded-lg bg-accent py-3 text-sm font-bold text-bg transition hover:bg-accent/85 disabled:cursor-wait disabled:opacity-60">
        Permitir
      </button>
    </div>
  );
}
