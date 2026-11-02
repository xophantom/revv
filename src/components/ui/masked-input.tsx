"use client";
import * as React from "react";
import { centsToInput, realToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Affix, Input, type InputProps } from "./input";

type Base = Omit<InputProps, "value" | "defaultValue" | "onChange" | "type">;

const grouped = new Intl.NumberFormat("pt-BR");
const formatInt = (n: number | null) => (n == null ? "" : grouped.format(n));

// After the text is reformatted, puts the caret back after the same number of digits.
function keepCaret(el: HTMLInputElement, digitsBefore: number) {
  requestAnimationFrame(() => {
    if (document.activeElement !== el) return;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < digitsBefore; pos++) if (/\d/.test(el.value[pos])) seen++;
    el.setSelectionRange(pos, pos);
  });
}

// Whole number with thousands separators ("52.300"). Not type=number: that one changes the value
// on scroll and shows no separators. The plain digits go in a hidden input under `name`, so
// FormData gets "52300". Controlled through value/onValueChange, or uncontrolled via defaultValue.
export function IntegerInput({ name, value, defaultValue, onValueChange, suffix, ...props }: Base & {
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  suffix?: string;
}) {
  const [own, setOwn] = React.useState<number | null>(defaultValue ?? null);
  const current = value !== undefined ? value : own;

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const shown = formatInt(current);
    let digitsBefore = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/\D/g, "").length;
    let digits = el.value.replace(/\D/g, "");
    // Deleting a separator alone changes nothing (it comes right back), so delete the digit beside it.
    if (digits === shown.replace(/\D/g, "") && el.value.length < shown.length) {
      const type = (e.nativeEvent as InputEvent).inputType;
      if (type === "deleteContentBackward" && digitsBefore > 0) {
        digits = digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore);
        digitsBefore -= 1;
      } else if (type === "deleteContentForward") {
        digits = digits.slice(0, digitsBefore) + digits.slice(digitsBefore + 1);
      }
    }
    digits = digits.slice(0, 9);
    const next = digits ? Number(digits) : null;
    setOwn(next);
    onValueChange?.(next);
    keepCaret(el, digitsBefore);
  }

  const input = <Input {...props} type="text" inputMode="numeric" autoComplete="off" value={formatInt(current)} onChange={onChange} />;
  return (
    <>
      {suffix ? <Affix suffix={suffix}>{input}</Affix> : input}
      {name && <input type="hidden" name={name} value={current ?? ""} />}
    </>
  );
}

// Decimal typed with comma or dot ("4,2"). Keeps the typed text, so "4," survives until the next digit.
export function DecimalInput({ value, onValueChange, suffix, ...props }: Base & {
  value?: number | null;
  onValueChange: (value: number | null) => void;
  suffix?: string;
}) {
  const [text, setText] = React.useState(value == null ? "" : String(value).replace(".", ","));
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/[^\d.,]/g, "");
    if ((next.match(/[.,]/g) ?? []).length > 1) return; // one decimal mark; the keystroke is dropped
    const n = Number(next.replace(",", "."));
    setText(next);
    onValueChange(next === "" || !Number.isFinite(n) ? null : n);
  }
  const input = <Input {...props} type="text" inputMode="decimal" autoComplete="off" value={text} onChange={onChange} />;
  return suffix ? <Affix suffix={suffix}>{input}</Affix> : input;
}

// Money typed freely after a fixed "R$". On blur it is rewritten the way it will be saved
// ("1500.5" → "1.500,50"), so a misread separator shows before saving. Read it with realToCents.
export function MoneyInput({ defaultCents = 0, onBlur, ...props }: Base & { defaultCents?: number }) {
  const [text, setText] = React.useState(centsToInput(defaultCents));
  return (
    <Affix prefix="R$">
      <Input {...props} type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={(e) => { setText(text.trim() ? centsToInput(realToCents(text)) : ""); onBlur?.(e); }} />
    </Affix>
  );
}

// Plate in capitals, letters and digits only (ABC1D23, ABC-1234).
export function PlateInput({ className, ...props }: Omit<InputProps, "onChange" | "type">) {
  return (
    <Input {...props} type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={8}
      className={cn("mono uppercase", className)}
      onChange={(e) => {
        const el = e.target;
        const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9-]/g, "");
        const pos = el.selectionStart == null ? null : clean(el.value.slice(0, el.selectionStart)).length;
        el.value = clean(el.value);
        if (pos != null) el.setSelectionRange(pos, pos);
      }} />
  );
}
