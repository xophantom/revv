"use client";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui/panel";
import { formatKmPerLiter } from "@/domain/fuel";
import { formatDateOnly } from "@/lib/dates";

const ACCENT = "#ff6a00";
const GRID = "rgba(255,255,255,.08)";
const MUTED = "rgba(255,255,255,.55)";
const TICK = { fill: MUTED, fontSize: 11 };

export type ConsumptionPoint = { date: string; kmPerLiter: number }; // date: ISO, UTC midnight

const intFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function TooltipContent({ active, payload }: { active?: boolean; payload?: readonly { payload?: ConsumptionPoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs shadow-lg">
      <div className="font-bold text-fg">{formatKmPerLiter(point.kmPerLiter)}</div>
      <div className="text-muted">{formatDateOnly(point.date, "dd 'de' MMMM 'de' yyyy")}</div>
    </div>
  );
}

// km/l per full tank over time, with the history's average as a dashed reference.
export function ConsumptionChart({ points, average }: { points: ConsumptionPoint[]; average: number | null }) {
  return (
    <Panel title="Consumo por tanque" className="min-w-0" action={average != null && (
      <span className="tabular-nums inline-flex items-center gap-1.5 text-[11px] text-muted">
        <span aria-hidden className="w-3 border-t border-dashed border-muted" />
        média {formatKmPerLiter(average)}
      </span>
    )}>
      {/* SVG tick text inherits tabular figures from this wrapper. */}
      <div className="tabular-nums">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDateOnly(d, "dd/MM/yy")} tick={TICK} stroke={GRID} tickLine={false} padding={{ left: 8, right: 8 }} minTickGap={16} />
            <YAxis
              domain={[(min: number) => Math.max(0, Math.floor(min - 1)), (max: number) => Math.ceil(max + 1)]}
              tickFormatter={(v: number) => intFormat.format(v)} tick={TICK} axisLine={false} tickLine={false} width="auto" allowDecimals={false}
            />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "rgba(255,255,255,.2)" }} />
            {average != null && <ReferenceLine y={average} stroke={MUTED} strokeDasharray="4 4" />}
            <Line type="linear" dataKey="kmPerLiter" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#141416", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
