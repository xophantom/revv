"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { centsToBRL } from "@/lib/money";

type Props = { byMonth: { month: string; cents: number }[] };

const GRID = "rgba(255,255,255,.08)";
const TICK = { fill: "rgba(255,255,255,.55)", fontSize: 11 };

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="mono rounded-md border border-border bg-surface2 px-3 py-2 text-xs">
      <div className="text-muted">{label}</div>
      <div className="font-bold text-accent">{centsToBRL(payload[0].value * 100)}</div>
    </div>
  );
}

export function SpendOverTime({ byMonth }: Props) {
  if (!byMonth.length) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Gastos no tempo</div>
        <p className="mono text-sm text-muted">// sem dados</p>
      </div>
    );
  }
  const data = byMonth.map((m) => ({ month: m.month, reais: m.cents / 100 }));
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Gastos no tempo</div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6a00" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff6a00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={TICK} stroke={GRID} tickLine={false} />
          <YAxis tick={TICK} stroke={GRID} tickLine={false} width={48} />
          <Tooltip content={<TooltipContent />} cursor={{ stroke: GRID }} />
          <Area type="monotone" dataKey="reais" stroke="#ff6a00" strokeWidth={2} fill="url(#spendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
