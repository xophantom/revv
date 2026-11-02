"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui/panel";
import { longMonthLabel, shortMonthLabel, type MonthTotal } from "@/domain/finance";
import { centsToBRL, centsToCompactBRL } from "@/lib/money";

const ACCENT = "#ff6a00";
const GRID = "rgba(255,255,255,.08)";
const TICK = { fill: "rgba(255,255,255,.55)", fontSize: 11 };

// Round steps (R$ 500, R$ 1 mil, R$ 2,5 mil...); Recharts' own ticks land on values like R$ 650.
function axisTicks(maxCents: number): number[] {
  const raw = maxCents / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(100, ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude); // at least R$ 1
  return Array.from({ length: Math.ceil(maxCents / step) + 1 }, (_, i) => i * step);
}

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: readonly { value?: unknown }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs shadow-lg">
      <div className="font-bold text-fg">{centsToBRL(Number(payload[0].value))}</div>
      <div className="text-muted">{longMonthLabel(String(label))}</div>
    </div>
  );
}

export function SpendOverTime({ byMonth, emptyLabel }: { byMonth: MonthTotal[]; emptyLabel: string }) {
  const maxCents = Math.max(0, ...byMonth.map((m) => m.cents));
  const hasSpend = maxCents > 0;
  const ticks = hasSpend ? axisTicks(maxCents) : [];
  return (
    <Panel title="Gastos por mês" className="min-w-0">
      {!hasSpend ? (
        <p className="mono text-sm text-muted">{emptyLabel}</p>
      ) : (
        // SVG tick text inherits the mono font from this wrapper.
        <div className="mono">
          <ResponsiveContainer width="100%" height={240}>
            {/* Bars, not a smoothed area: spend is per month, and empty months stay visibly empty. */}
            <BarChart data={byMonth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" tickFormatter={shortMonthLabel} tick={TICK} stroke={GRID} tickLine={false} padding={{ left: 8, right: 8 }} minTickGap={12} />
              <YAxis ticks={ticks} domain={[0, ticks.at(-1) ?? 0]} tickFormatter={centsToCompactBRL} tick={TICK} axisLine={false} tickLine={false} width="auto" allowDecimals={false} />
              <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <Bar dataKey="cents" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
