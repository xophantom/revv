"use client";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { centsToBRL } from "@/lib/money";

type Props = { maintenanceCents: number; upgradeCents: number };

const GRID = "rgba(255,255,255,.08)";
const TICK = { fill: "rgba(255,255,255,.55)", fontSize: 11 };
const COLORS = ["#ff6a00", "#6b7280"];

function TooltipContent({ active, payload }: { active?: boolean; payload?: { value: number; payload: { name: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="mono rounded-md border border-border bg-surface2 px-3 py-2 text-xs">
      <div className="text-muted">{payload[0].payload.name}</div>
      <div className="font-bold text-accent">{centsToBRL(payload[0].value * 100)}</div>
    </div>
  );
}

export function CategoryBreakdown({ maintenanceCents, upgradeCents }: Props) {
  const data = [
    { name: "Manutenções", reais: maintenanceCents / 100 },
    { name: "Upgrades", reais: upgradeCents / 100 },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">Manutenções vs Upgrades</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={TICK} stroke={GRID} tickLine={false} />
          <YAxis tick={TICK} stroke={GRID} tickLine={false} width={48} />
          <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
          <Bar dataKey="reais" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
