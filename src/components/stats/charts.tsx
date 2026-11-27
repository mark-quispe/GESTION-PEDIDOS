import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos en SVG sencillo, del mismo trazo que el Design final: barras grises,
 * la última en blanco, ejes en mono. Las barras crecen desde la base al entrar.
 */

export function ChartCard({ title, aside, note, children, className, i = 0 }: { title: string; aside?: ReactNode; note?: ReactNode; children: ReactNode; className?: string; i?: number }) {
  return (
    <section className={cn("enter flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4", className)} style={{ "--i": i } as React.CSSProperties}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {aside && <span className="font-mono text-[11px] text-muted">{aside}</span>}
      </div>
      {children}
      {note && <p className="mt-auto text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

export function Bars({ data, height = 140, format = (v: number) => String(v), highlightLast = true, tone }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string; highlightLast?: boolean; tone?: string }) {
  const w = 420;
  const left = 40;
  const bottom = height - 18;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const slot = (w - left) / Math.max(1, data.length);
  const every = Math.ceil(data.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      {[0, 0.5, 1].map((f) => {
        const y = bottom - f * (bottom - 6);
        return (
          <g key={f}>
            <line x1={left} x2={w} y1={y} y2={y} stroke="var(--line)" />
            <text x={left - 6} y={y + 3} textAnchor="end" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
              {format(nice * f)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bw = Math.max(3, slot * 0.6);
        const x = left + i * slot + (slot - bw) / 2;
        const bh = (d.value / nice) * (bottom - 6);
        const last = highlightLast && i === data.length - 1;
        return (
          <g key={i}>
            {bh > 0 && (
              <rect x={x} y={bottom - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} fill={tone ?? (last ? "var(--fg)" : "var(--bar)")} className="grow-y" style={{ "--i": i } as React.CSSProperties}>
                <title>{`${d.label} · ${format(d.value)}`}</title>
              </rect>
            )}
            {i % every === 0 && (
              <text x={x + bw / 2} y={height - 3} textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ data, format = (v: number) => String(v), max: forced }: { data: { label: string; value: number; tone?: string; sub?: string }[]; format?: (v: number) => string; max?: number }) {
  const max = forced ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={d.label} className="grid grid-cols-[minmax(90px,140px)_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-fg-2">{d.label}</span>
          <span className="h-2 overflow-hidden rounded-sm bg-line">
            <span className="grow-x block h-full rounded-sm" style={{ width: `${(d.value / max) * 100}%`, background: d.tone ?? (i === 0 ? "var(--fg)" : "var(--bar)"), "--i": i } as React.CSSProperties} />
          </span>
          <span className="text-right font-mono text-xs">
            {format(d.value)}
            {d.sub && <span className="ml-1 text-faint">{d.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150, center }: { data: { label: string; value: number; color: string }[]; size?: number; center?: ReactNode }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" width={size} height={size} className="-rotate-90" role="img" aria-label={data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)} %`).join(", ")}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = (
            <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} className="donut-in">
              <title>{`${d.label} · ${Math.round((d.value / total) * 100)} %`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute text-center">{center}</div>}
    </div>
  );
}

export function Spark({ values, width = 120, height = 28, color = "var(--fg)" }: { values: (number | null)[]; width?: number; height?: number; color?: string }) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(1, ...nums);
  const step = width / Math.max(1, values.length - 1);
  const pts = nums.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="line-draw" />
    </svg>
  );
}

export function Line({ values, labels, height = 120, format = (v: number) => String(v) }: { values: (number | null)[]; labels: string[]; height?: number; format?: (v: number) => string }) {
  const w = 420;
  const left = 36;
  const bottom = height - 18;
  const nums = values.map((v) => v ?? 0);
  const max = niceMax(Math.max(1, ...nums));
  const step = (w - left - 8) / Math.max(1, values.length - 1);
  const pts = nums.map((v, i) => [left + i * step, bottom - (v / max) * (bottom - 6)] as const);
  const every = Math.ceil(labels.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label={labels.map((l, i) => `${l}: ${format(nums[i])}`).join(", ")}>
      {[0, 0.5, 1].map((f) => {
        const y = bottom - f * (bottom - 6);
        return (
          <g key={f}>
            <line x1={left} x2={w} y1={y} y2={y} stroke="var(--line)" />
            <text x={left - 6} y={y + 3} textAnchor="end" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
              {format(max * f)}
            </text>
          </g>
        );
      })}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--fg)" strokeWidth="1.6" strokeLinejoin="round" pathLength={1} className="line-draw" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3 : 2} fill={i === pts.length - 1 ? "var(--fg)" : "var(--bar)"}>
          <title>{`${labels[i]} · ${format(nums[i])}`}</title>
        </circle>
      ))}
      {labels.map((l, i) =>
        i % every === 0 ? (
          <text key={i} x={left + i * step} y={height - 3} textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function Stacked({ data, keys, height = 130 }: { data: ({ label: string } & Record<string, number | string>)[]; keys: { key: string; color: string; label: string }[]; height?: number }) {
  const w = 420;
  const left = 28;
  const bottom = height - 18;
  const totals = data.map((d) => keys.reduce((a, k) => a + Number(d[k.key] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const slot = (w - left) / Math.max(1, data.length);
  const every = Math.ceil(data.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label="Por semana">
      <line x1={left} x2={w} y1={bottom} y2={bottom} stroke="var(--line)" />
      <text x={left - 6} y={9} textAnchor="end" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
        {max}
      </text>
      {data.map((d, i) => {
        const bw = Math.max(3, slot * 0.55);
        const x = left + i * slot + (slot - bw) / 2;
        let y = bottom;
        return (
          <g key={i} className="grow-y" style={{ "--i": i } as React.CSSProperties}>
            {keys.map((k) => {
              const v = Number(d[k.key] ?? 0);
              const h = (v / max) * (bottom - 6);
              y -= h;
              return h > 0 ? (
                <rect key={k.key} x={x} y={y} width={bw} height={h} fill={k.color}>
                  <title>{`${d.label} · ${k.label}: ${v}`}</title>
                </rect>
              ) : null;
            })}
            {i % every === 0 && (
              <text x={x + bw / 2} y={height - 3} textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="9.5">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
