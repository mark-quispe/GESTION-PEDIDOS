"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Download, Search } from "lucide-react";
import type { JobStatus } from "@/db/schema";
import type { HistoryGroup, HistoryRow } from "@/lib/queries/history";
import { STATUS_LABEL, firstName, initials, normalizeText } from "@/lib/domain";
import { addDays, dayKey, timeLima, todayLima, weekdayLong } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";

const GROUPS: { g: HistoryGroup; label: string }[] = [
  { g: "estados", label: "Estados" },
  { g: "precios", label: "Precios" },
  { g: "pagos", label: "Pagos" },
  { g: "eliminados", label: "Eliminados" },
  { g: "tomados", label: "Tomados y soltados" },
  { g: "items", label: "Ítems hechos" },
  { g: "accesos", label: "Accesos" },
  { g: "otros", label: "Clientes y otros" },
];
type Range = "hoy" | "7d" | "mes";
const DANGER = new Set(["anular", "eliminar", "anular_pago"]);

function dayTitle(day: string) {
  const t = todayLima();
  const d = new Date(`${day}T12:00:00-05:00`);
  const rest = `${weekdayLong(d)} ${Number(day.slice(8))}`.toUpperCase();
  if (day === t) return `HOY · ${rest}`;
  if (day === addDays(t, -1)) return `AYER · ${rest}`;
  return rest;
}

/** Lo que va a la derecha: el cambio de valor, si lo hay. */
function change(r: HistoryRow): { from?: string; to: string; danger?: boolean } | null {
  const b = (r.before ?? {}) as Record<string, unknown>;
  const a = (r.after ?? {}) as Record<string, unknown>;
  if (typeof a.status === "string") return { from: typeof b.status === "string" ? STATUS_LABEL[b.status as JobStatus] : undefined, to: STATUS_LABEL[a.status as JobStatus], danger: a.status === "cancelado" };
  if (typeof a.price === "number" && typeof b.price === "number" && a.price !== b.price) return { from: formatMoney(b.price), to: formatMoney(a.price) };
  if (typeof a.amount === "number" && typeof b.amount === "number") return { from: formatMoney(b.amount), to: formatMoney(a.amount) };
  if (typeof a.basePrice === "number" && typeof b.basePrice === "number") return { from: formatMoney(b.basePrice), to: formatMoney(a.basePrice) };
  if (Array.isArray(a.roles) && Array.isArray(b.roles)) return { from: b.roles.join(" + "), to: a.roles.join(" + ") };
  if (r.group === "pagos") {
    const m = r.summary.match(/S\/\s?[\d.,]+/);
    if (m) return { to: m[0] };
  }
  return null;
}

/** RF-21: Historial, igual al Design final. No se puede editar ni borrar. */
export function HistoryBoard({ rows }: { rows: HistoryRow[] }) {
  const [range, setRange] = useState<Range>("7d");
  const [off, setOff] = useState<HistoryGroup[]>(["accesos"]);
  const [who, setWho] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const t = todayLima();
  const from = range === "hoy" ? t : range === "7d" ? addDays(t, -6) : addDays(t, -30);
  const inRange = rows.filter((r) => dayKey(r.at) >= from);
  const term = normalizeText(q);
  const searched = term ? inRange.filter((r) => normalizeText(`${r.jobCode ?? ""} ${r.clientName ?? ""} ${r.summary}`).includes(term)) : inRange;
  const shown = searched.filter((r) => !off.includes(r.group) && (!who.length || who.includes(r.userId ?? "")));

  const people = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const r of searched.filter((r) => !off.includes(r.group))) {
      const k = r.userId ?? "";
      m.set(k, { id: k, name: r.userName, n: (m.get(k)?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [searched, off]);

  const days = useMemo(() => {
    const m = new Map<string, HistoryRow[]>();
    for (const r of shown) m.set(dayKey(r.at), [...(m.get(dayKey(r.at)) ?? []), r]);
    return [...m.entries()];
  }, [shown]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] [&_*]:leading-[normal]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-muted">11 · Historial</p>
          <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Historial</h1>
          <p className="text-sm text-muted">Quién cambió qué y cuándo. No se puede editar ni borrar.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-9 w-[240px] items-center gap-2 rounded-md border bg-bg px-3 text-[13px] focus-within:border-muted">
            <Search className="size-3.5 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código o cliente" aria-label="Buscar en el historial" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
          </label>
          <a href={`/api/export?tablas=historial&desde=${from}`} className="press inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3.5 text-sm font-medium">
            <Download className="size-4" /> Exportar
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-7 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-[22px] lg:w-[230px]">
          <div>
            <p className="font-mono text-[11px] text-muted">FECHAS</p>
            <div role="radiogroup" aria-label="Fechas" className="mt-2 inline-flex rounded-[7px] border bg-surface p-[3px]">
              {(
                [
                  ["hoy", "Hoy"],
                  ["7d", "7 días"],
                  ["mes", "Mes"],
                ] as [Range, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={range === v}
                  onClick={() => setRange(v)}
                  className={cn("press h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors", range === v ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] text-muted">QUÉ</p>
            <div className="mt-1.5">
              {GROUPS.map(({ g, label }) => {
                const on = !off.includes(g);
                const n = searched.filter((r) => r.group === g).length;
                return (
                  <label key={g} className={cn("flex cursor-pointer items-center justify-between py-[7px] text-sm", on ? "text-fg" : "text-muted")}>
                    <span className="flex items-center gap-2.5">
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setOff((o) => (on ? [...o, g] : o.filter((x) => x !== g)))} />
                      <span className={cn("grid size-[15px] place-items-center rounded-[4px] border transition-colors", on ? "border-fg bg-fg text-bg" : "border-[#4a4a4a]")}>{on && <Check className="size-2.5" strokeWidth={3.5} />}</span>
                      {label}
                    </span>
                    <span className="font-mono text-[11px] text-faint">{n}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] text-muted">QUIÉN</p>
            <div className="mt-1.5">
              {people.map((p) => {
                const on = who.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setWho((w) => (on ? w.filter((x) => x !== p.id) : [...w, p.id]))}
                    aria-pressed={on}
                    className={cn("flex w-full items-center justify-between rounded-md py-1.5 text-left text-sm transition-colors", who.length && !on ? "text-muted" : "text-fg")}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-full border bg-line text-[7px] font-semibold", on && "border-fg")}>{initials(p.name)}</span>
                      {p.name}
                    </span>
                    <span className="font-mono text-[11px] text-faint">{p.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-2 lg:overflow-y-auto lg:pr-1">
          {days.length === 0 && <p className="mt-1.5 rounded-lg border border-dashed px-4 py-12 text-center text-[13px] text-muted">No hay cambios con estos filtros.</p>}
          {days.map(([day, list]) => (
            <div key={day} className="flex flex-col gap-2">
              <p className="mt-1.5 font-mono text-[11px] text-muted">{dayTitle(day)}</p>
              {list.map((r) => (
                <Entry key={r.id} r={r} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Entry({ r }: { r: HistoryRow }) {
  const [sentence, ...rest] = r.summary.split(" · ");
  const ch = change(r);
  const danger = DANGER.has(r.action);
  const a = (r.after ?? {}) as { hechos?: string[]; faltan?: string[]; nota?: string | null };
  const details: [string, string][] = [];
  if (r.action === "soltar" && (a.hechos?.length || a.faltan?.length)) {
    if (a.hechos?.length) details.push(["Hizo", a.hechos.join(" · ")]);
    if (a.faltan?.length) details.push(["Falta", `${a.faltan.join(" · ")} → volvió a Por tomar`]);
    if (a.nota) details.push(["Nota", `«${a.nota}»`]);
  } else if (rest.length) {
    rest.forEach((x, i) => details.push([x.startsWith("«") ? "Nota" : i === 0 && danger ? "Motivo" : "Detalle", x]));
  }
  const sub = [timeLima(r.at), r.jobTitle, r.clientName].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="grid size-[30px] shrink-0 place-items-center rounded-full border bg-line text-[10px] font-semibold">{initials(r.userName)}</span>
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{firstName(r.userName)}</span> <span className="text-muted">{sentence.replace(/:.*$/, "")}</span>
          {r.jobCode && <span className="ml-1 font-mono text-[13px]">{r.jobCode}</span>}
        </p>
        <p className="mt-0.5 truncate text-xs text-faint">{sub}</p>
        {details.length > 0 && (
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-[3px] text-xs">
            {details.map(([k, v], i) => (
              <span key={i} className="contents">
                <span className="text-faint">{k}</span>
                <span className={k === "Motivo" ? "text-fg" : k === "Falta" ? "text-warning" : "text-muted"}>{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {ch ? (
        <span className="inline-flex h-[26px] items-center gap-2 rounded-md border bg-bg px-2.5 font-mono text-xs whitespace-nowrap">
          {ch.from && (
            <>
              <span className="text-[#8a8a8a]">{ch.from}</span>
              <span className="text-faint">→</span>
            </>
          )}
          <span className={ch.danger ? "text-danger" : undefined}>{ch.to}</span>
        </span>
      ) : (
        <span className="h-px w-3 self-center bg-border" />
      )}
    </>
  );
  const cls = cn("row grid grid-cols-[30px_minmax(0,1fr)_auto] gap-3.5 rounded-lg border bg-surface px-4 py-3", details.length ? "items-start" : "items-center", danger && "border-danger-line");
  return r.jobCode ? (
    <Link href={`/trabajos/${r.jobCode}`} className={cls}>
      {body}
    </Link>
  ) : (
    <article className={cls}>{body}</article>
  );
}
