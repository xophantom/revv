"use client";
import * as React from "react";
import { Label, labelClass } from "./label";

const FieldContext = React.createContext<string | undefined>(undefined);

// Id for the control inside a <Field>, so its label is wired up without passing ids around.
export const useFieldId = () => React.useContext(FieldContext);

// `group` is for a set of controls (chips): the label names the group instead of one input.
export function Field({ label, hint, group = false, className, children }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  group?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className={className}>
      {group ? (
        <>
          <span id={id} className={labelClass}>{label}</span>
          <div role="group" aria-labelledby={id}>{children}</div>
        </>
      ) : (
        <>
          <Label htmlFor={id}>{label}</Label>
          <FieldContext.Provider value={id}>{children}</FieldContext.Provider>
        </>
      )}
      {hint && <p className="tabular-nums mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
