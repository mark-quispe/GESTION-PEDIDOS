"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";

type Point = { day: string; label: string; total: number };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground">{p.label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{formatMoney(p.total)}</p>
    </div>
  );
}

/** RF-20: ingresos del mes por día. Una sola serie, sin leyenda: el título la nombra. */
export function IncomeChart({ data }: { data: Point[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label="Ingresos por día del mes">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} mil` : String(v))}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.6 }} content={<ChartTooltip />} isAnimationActive={false} />
          <Bar dataKey="total" fill="var(--foreground)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
