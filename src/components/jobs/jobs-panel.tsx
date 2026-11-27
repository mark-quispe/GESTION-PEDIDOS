"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Archive, Briefcase, CalendarClock, CalendarDays, ChevronDown, CircleCheck, Clock3, Layers, ListFilter, Loader, Maximize2, Plus, Search, X } from "lucide-react";
import type { JobRow } from "@/lib/queries/jobs";
import { normalizeText } from "@/lib/domain";
import { addDays, dayKey, dueLabel, todayLima, weekStart } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { TakeButton } from "@/components/jobs/bits";
import { useJobDialogs } from "@/components/jobs/job-dialogs";

type Tab = "curso" | "finalizados" | "todos";
type Extra = "tomar" | "atrasados" | "mios" | "urgentes";

const closed = (r: JobRow) => r.status === "finalizado" || r.status === "cancelado";
const pool = (r: JobRow) => !r.responsibleId && !r.externoId && ["confirmado", "en_proceso", "correcciones"].includes(r.status);

const EXTRAS: { k: Extra; label: string }[] = [
  { k: "tomar", label: "Solo por tomar" },
  { k: "atrasados", label: "Solo atrasados" },
  { k: "mios", label: "Solo los míos" },
  { k: "urgentes", label: "Urgentes y alta" },
];

function barClass(r: JobRow) {
  if (r.late) return "bg-danger";
  if (pool(r) || r.status === "cotizacion" || r.status === "correcciones") return "bg-warning";
  if (r.status === "en_proceso" || r.status === "en_revision") return "bg-info";
  if (r.status === "finalizado") return "bg-success";
  if (r.status === "terminado") return "bg-fg";
  return "bg-faint";
}

/** Panel «Trabajos» que sale desde la ficha (RF-12), con el rediseño de Mark del 27/11. */
export function JobsPanel({ rows, activeCode, canTake, meId, onClose }: { rows: JobRow[]; activeCode?: string; canTake: boolean; meId: string; onClose: () => void }) {
  const { openNewJob } = useJobDialogs();
  const [tab, setTab] = useState<Tab>("curso");
  const [q, setQ] = useState("");
  const [extras, setExtras] = useState<Extra[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shut, setShut] = useState<string[]>(["closed"]);

  const inTab = useMemo(() => rows.filter((r) => (tab === "curso" ? !closed(r) : tab === "finalizados" ? r.status === "finalizado" : true)), [rows, tab]);
  const term = normalizeText(q);
  const visible = inTab.filter((r) => {
    if (term && !normalizeText(`${r.code} ${r.title} ${r.clientName} ${r.responsibleName ?? ""} ${r.externoName ?? ""} ${r.course ?? ""}`).includes(term)) return false;
    if (extras.includes("tomar") && !pool(r)) return false;
    if (extras.includes("atrasados") && !r.late) return false;
    if (extras.includes("mios") && r.responsibleId !== meId) return false;
    if (extras.includes("urgentes") && r.urgency === "normal") return false;
    return true;
  });

  const endOfWeek = addDays(weekStart(todayLima()), 6);
  const open = visible.filter((r) => !closed(r)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const groups: { key: string; label: string; icon: ReactNode; danger?: boolean; rows: JobRow[] }[] = [
    { key: "late", label: "Atrasados", icon: <Clock3 className="size-5 text-danger" />, danger: true, rows: open.filter((r) => r.late) },
    { key: "week", label: "Esta semana", icon: <CalendarDays className="size-5 text-info" />, rows: open.filter((r) => !r.late && dayKey(r.dueAt) <= endOfWeek) },
    { key: "later", label: "Más adelante", icon: <CalendarClock className="size-5 text-muted" />, rows: open.filter((r) => !r.late && dayKey(r.dueAt) > endOfWeek) },
    { key: "closed", label: tab === "finalizados" ? "Finalizados" : "Cerrados", icon: <Archive className="size-5 text-muted" />, rows: visible.filter(closed).sort((a, b) => (b.finishedAt ?? b.dueAt).localeCompare(a.finishedAt ?? a.dueAt)) },
  ].filter((g) => g.rows.length > 0);

  const stats = [
    { label: "Total", value: inTab.length, icon: <Layers className="size-5" />, tone: "" },
    { label: "En curso", value: inTab.filter((r) => r.status === "en_proceso").length, icon: <Loader className="size-5 text-info" />, tone: "bg-info-soft" },
    { label: "Por tomar", value: inTab.filter(pool).length, icon: <Clock3 className="size-5 text-warning" />, tone: "bg-warning-soft" },
    { label: "Finalizados", value: rows.filter((r) => r.status === "finalizado").length, icon: <CircleCheck className="size-5 text-success" />, tone: "bg-success-soft" },
  ];
  const pending = visible.filter((r) => !closed(r) && r.status !== "cotizacion").reduce((a, r) => a + r.pending, 0);
  const toggle = (k: string) => setShut((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <div className="flex min-h-0 flex-1 flex-col [&_*]:leading-[normal]">
      <header className="flex items-start justify-between gap-3 px-6 pt-1 pb-4">
        <div className="flex items-start gap-3.5">
          <Briefcase className="mt-1 size-7 text-fg" strokeWidth={1.6} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Trabajos</h1>
            <p className="mt-1 text-[15px] text-muted">
              {inTab.length} {inTab.length === 1 ? "trabajo" : "trabajos"} {tab === "curso" ? "en curso" : tab === "finalizados" ? "finalizados" : "en total"}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <Link href="/trabajos" onClick={onClose} aria-label="Abrir la lista completa" title="Abrir la lista completa" className="press grid size-10 place-items-center rounded-md border text-muted hover-fine:hover:text-fg">
            <Maximize2 className="size-[18px]" />
          </Link>
          <button type="button" aria-label="Cerrar lista" title="Cerrar (Esc)" onClick={onClose} className="press grid size-10 place-items-center rounded-md border text-muted hover-fine:hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3.5 px-6 pb-4">
        <label className="flex h-11 items-center gap-3 rounded-lg border bg-bg/50 px-3.5 focus-within:border-muted">
          <Search className="size-[18px] text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar trabajo, código o responsable…" aria-label="Buscar trabajos" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          {q && (
            <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")} className="text-muted hover-fine:hover:text-fg">
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="flex items-center justify-between gap-3">
          <div role="tablist" aria-label="Qué trabajos ver" className="flex gap-1 rounded-lg bg-bg/50 p-1">
            {(
              [
                ["curso", "En curso"],
                ["finalizados", "Finalizados"],
                ["todos", "Todos"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("press inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-[14px] font-medium whitespace-nowrap transition-colors sm:px-3.5 sm:text-[15px]", tab === k ? "border-muted bg-line text-fg" : "border-transparent text-muted hover-fine:hover:text-fg")}
              >
                {label}
                {tab === k && <span className="grid h-6 min-w-6 place-items-center rounded-md bg-border px-1.5 text-xs">{inTab.length}</span>}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn("press inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-[15px] font-medium", extras.length && "border-muted")}
            >
              <ListFilter className="size-[18px]" /> <span className="hidden sm:inline">Filtros</span>
              {extras.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">{extras.length}</span>}
            </button>
            {filtersOpen && (
              <div className="pop-in absolute top-[calc(100%+6px)] right-0 z-10 w-[220px] origin-top-right rounded-lg border bg-surface p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                {EXTRAS.filter((e) => e.k !== "mios" || canTake).map((e) => {
                  const on = extras.includes(e.k);
                  return (
                    <button key={e.k} onClick={() => setExtras((x) => (on ? x.filter((y) => y !== e.k) : [...x, e.k]))} className="row flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm">
                      {e.label}
                      <span className={cn("grid size-4 place-items-center rounded-[4px] border", on ? "border-fg bg-fg text-bg" : "border-[#4a4a4a]")}>{on && <span className="text-[10px] font-bold">✓</span>}</span>
                    </button>
                  );
                })}
                {extras.length > 0 && (
                  <button onClick={() => setExtras([])} className="mt-1 w-full border-t border-line px-2.5 pt-2 pb-1 text-left text-[13px] text-muted hover-fine:hover:text-fg">
                    Quitar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-3">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-line [&>svg]:size-[18px]", s.tone)}>{s.icon}</span>
              <span className="min-w-0">
                <span className="block text-[19px] font-semibold tabular-nums">{s.value}</span>
                <span className="block text-[12.5px] whitespace-nowrap text-muted">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5">
        {groups.length === 0 && <p className="rounded-lg border border-dashed px-5 py-10 text-center text-sm text-faint">{q || extras.length ? "Nada coincide con los filtros." : "No hay trabajos aquí."}</p>}
        {groups.map((g) => {
          const isShut = shut.includes(g.key) && !(g.key === "closed" && tab === "finalizados");
          return (
            <section key={g.key} className="shrink-0 overflow-hidden rounded-lg border bg-surface">
              <button type="button" onClick={() => toggle(g.key)} aria-expanded={!isShut} className="row flex w-full items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-[17px] font-semibold">
                  {g.icon}
                  {g.label}
                  <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold", g.danger ? "bg-danger-soft text-danger ring-1 ring-danger-line" : "bg-line text-muted")}>{g.rows.length}</span>
                </span>
                <ChevronDown className={cn("size-5 text-muted transition-transform duration-200 ease-(--ease-out)", !isShut && "rotate-180")} />
              </button>
              {!isShut &&
                g.rows.map((r) => {
                  const k = dayKey(r.dueAt);
                  const isToday = k === todayLima();
                  return (
                    <Link
                      key={r.id}
                      href={`/trabajos/${r.code}`}
                      onClick={onClose}
                      aria-current={r.code === activeCode ? "page" : undefined}
                      className={cn("reveal row relative grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line py-2 pr-4 pl-5", r.code === activeCode && "bg-hover")}
                    >
                      <span className={cn("absolute top-2 bottom-2 left-3 w-[3px] rounded-full", barClass(r))} />
                      <span className="flex min-w-0 items-center gap-4 pl-2">
                        <span className="hidden shrink-0 font-mono text-[12.5px] text-muted sm:inline">{r.code}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14.5px] font-medium">{r.title}</span>
                          <span className="block truncate text-[13px] text-muted">
                            <span className="font-mono text-[12px] sm:hidden">{r.code} · </span>
                            {r.clientName}
                          </span>
                        </span>
                      </span>
                      <span className={cn("font-mono text-[13px] tabular-nums", r.pending <= 0.004 && r.status !== "cotizacion" ? "text-success" : "")}>
                        {r.status === "cancelado" ? "—" : r.status === "cotizacion" ? formatMoney(r.total) : r.pending <= 0.004 ? "Pagado" : formatMoney(r.pending)}
                      </span>
                      <span className="relative flex items-center justify-end">
                        {r.late ? (
                          <span className="inline-flex h-6 items-center rounded-full border border-danger-line bg-danger-soft px-2 text-xs text-danger">
                            +{r.lateDays} {r.lateDays === 1 ? "día" : "días"}
                          </span>
                        ) : pool(r) ? (
                          <>
                            {canTake && (
                              <span className="act absolute top-1/2 right-[calc(100%+8px)] -mt-3.5 max-sm:hidden">
                                <TakeButton jobId={r.id} />
                              </span>
                            )}
                            <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-xs", canTake && "max-sm:hidden")}>Por tomar</span>
                            {canTake && <TakeButton jobId={r.id} className="sm:hidden" />}
                          </>
                        ) : isToday && !closed(r) ? (
                          <span className="inline-flex h-6 items-center rounded-full border border-warning-line bg-warning-soft px-2 text-xs font-medium text-warning">Hoy</span>
                        ) : (
                          <span className="text-xs text-muted">{closed(r) ? dueLabel(r.finishedAt ?? r.dueAt) : dueLabel(r.dueAt)}</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
            </section>
          );
        })}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <span className="text-[15px] text-muted">
          <span className="max-sm:block">Por cobrar:</span> <span className="text-[17px] font-semibold text-fg tabular-nums">{formatMoney(pending)}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            openNewJob();
          }}
          className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-medium whitespace-nowrap text-on-primary"
        >
          <Plus className="size-5" /> Nuevo trabajo
        </button>
      </footer>
    </div>
  );
}

