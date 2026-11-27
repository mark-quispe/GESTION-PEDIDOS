"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import type { JobRow } from "@/lib/queries/jobs";
import { normalizeText, STATUS_SHORT, statusTone, type Tone } from "@/lib/domain";
import { dayKey, dueLabel, todayLima, weekStart, addDays } from "@/lib/dates";
import { formatMoney, cn } from "@/lib/utils";
import { Dot, toneText } from "@/components/ui/badge";
import { Avatar, Kbd, TakeButton } from "@/components/jobs/bits";

export type ListTab = "curso" | "finalizados" | "todos";

type Group = { key: string; label: string; tone?: Tone; rows: JobRow[] };

/** RF-12: grupos Atrasados, Esta semana y Más adelante. */
function groupRows(rows: JobRow[], tab: ListTab): Group[] {
  if (tab === "finalizados") {
    const sorted = [...rows].sort((a, b) => (b.finishedAt ?? b.statusChangedAt).localeCompare(a.finishedAt ?? a.statusChangedAt));
    return [{ key: "fin", label: "Finalizados", rows: sorted }];
  }
  const endOfWeek = addDays(weekStart(todayLima()), 6);
  const open = rows.filter((r) => r.status !== "finalizado" && r.status !== "cancelado");
  const closed = rows.filter((r) => r.status === "finalizado" || r.status === "cancelado");
  const late = open.filter((r) => r.late);
  const week = open.filter((r) => !r.late && dayKey(r.dueAt) <= endOfWeek);
  const later = open.filter((r) => !r.late && dayKey(r.dueAt) > endOfWeek);
  const out: Group[] = [
    { key: "late", label: "Atrasados", tone: "danger", rows: late },
    { key: "week", label: "Esta semana", rows: week },
    { key: "later", label: "Más adelante", rows: later },
  ];
  if (tab === "todos") out.push({ key: "closed", label: "Cerrados", rows: closed.sort((a, b) => b.dueAt.localeCompare(a.dueAt)) });
  return out.filter((g) => g.rows.length > 0);
}

export function filterRows(rows: JobRow[], tab: ListTab, q: string, resp?: string | null) {
  const term = normalizeText(q);
  return rows.filter((r) => {
    if (tab === "curso" && (r.status === "finalizado" || r.status === "cancelado")) return false;
    if (tab === "finalizados" && r.status !== "finalizado") return false;
    if (resp && r.responsibleId !== resp && r.externoId !== resp) return false;
    if (!term) return true;
    return normalizeText(`${r.code} ${r.clientName} ${r.course ?? ""} ${r.title} ${r.clientPhone}`).includes(term);
  });
}

export function rowTone(r: JobRow): Tone {
  return statusTone(r.status, r.late, !r.responsibleId && !r.externoId);
}

function StatusCell({ r }: { r: JobRow }) {
  const unassigned = !r.responsibleId && !r.externoId;
  const tone: Tone =
    r.status === "en_proceso" ? "info" : r.status === "correcciones" || r.status === "cotizacion" ? "warning" : r.status === "finalizado" ? "success" : r.status === "terminado" ? "strong" : r.status === "cancelado" ? "muted" : r.status === "en_revision" ? "info" : "neutral";
  return (
    <span className={cn("truncate text-[13px]", toneText[tone])}>
      {STATUS_SHORT[r.status]}
      {unassigned && r.itemsDone > 0 && r.itemsDone < r.itemsTotal && <span className="text-warning"> · falta {r.itemsTotal - r.itemsDone} de {r.itemsTotal}</span>}
    </span>
  );
}

function WhoCell({ r, canTake }: { r: JobRow; canTake: boolean }) {
  if (r.externoName)
    return (
      <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-fg-2">
        <Avatar name={r.externoName} ext />
        <span className="truncate">Externo · {r.externoName.split(" ")[0]}</span>
      </span>
    );
  if (r.responsibleName)
    return (
      <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-fg-2">
        <Avatar name={r.responsibleName} />
        <span className="truncate">{r.responsibleName}</span>
      </span>
    );
  if (r.status === "cotizacion" || r.status === "finalizado" || r.status === "cancelado") return <span className="text-[13px] text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-[13px] text-warning">Por tomar</span>
      {canTake && <TakeButton jobId={r.id} />}
    </span>
  );
}

function MoneyCell({ r }: { r: JobRow }) {
  if (r.status === "cancelado") return <span className="font-mono text-xs text-faint">—</span>;
  if (r.status === "cotizacion") return <span className="font-mono text-xs text-muted">{formatMoney(r.total)}</span>;
  if (r.pending <= 0.004) return <span className="font-mono text-xs text-success">Pagado</span>;
  return <span className="font-mono text-xs">{formatMoney(r.pending)}</span>;
}

function DueCell({ r }: { r: JobRow }) {
  const today = dayKey(r.dueAt) === todayLima();
  return <span className={cn("font-mono text-xs", today && !r.late ? "text-warning" : "text-muted")}>{dueLabel(r.dueAt)}</span>;
}

const GRID = "md:grid-cols-[10px_minmax(0,1.6fr)_180px_minmax(0,1fr)_120px_90px]";

/** Lista a toda la pantalla de la pestaña Trabajos (RF-12). */
export function JobTable({ rows, canTake, footer, actions }: { rows: JobRow[]; canTake: boolean; footer?: ReactNode; actions?: ReactNode }) {
  const [tab, setTab] = useState<ListTab>("curso");
  const [q, setQ] = useState("");
  const search = useSearchKey();
  const counts = useMemo(() => ({ curso: filterRows(rows, "curso", "").length }), [rows]);
  const visible = filterRows(rows, tab, q);
  const groups = groupRows(visible, tab);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ListControls tab={tab} setTab={setTab} q={q} setQ={setQ} inputRef={search} count={counts.curso} actions={actions} />
      <div className="enter overflow-hidden rounded-lg border bg-surface/85">
        <div className={cn("hidden gap-x-[18px] border-b px-[18px] py-2.5 font-mono text-[10.5px] text-muted md:grid", GRID)}>
          <span />
          <span>Trabajo</span>
          <span>Estado</span>
          <span>Lo hace</span>
          <span className="text-right">Precio · pendiente</span>
          <span className="text-right">Entrega</span>
        </div>
        {groups.length === 0 && <p className="px-5 py-10 text-center text-sm text-faint">{q ? `Nada coincide con «${q}».` : "No hay trabajos aquí."}</p>}
        {groups.map((g) => (
          <div key={g.key}>
            <p className={cn("border-t border-line px-4 pt-3 pb-1.5 font-mono text-[11px] first:border-t-0 md:px-[18px]", g.tone === "danger" ? "text-danger" : "text-muted")}>
              {g.label}
            </p>
            {g.rows.map((r) => (
              <Link
                key={r.id}
                href={`/trabajos/${r.code}`}
                className={cn("row grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 px-4 py-2.5 md:gap-y-0 md:px-[18px]", GRID, "md:gap-x-[18px]")}
              >
                <Dot tone={rowTone(r)} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{r.title}</span>
                  <span className="truncate text-xs text-muted">
                    {r.code} · {r.clientName}
                  </span>
                </span>
                <span className="md:hidden">
                  <MoneyCell r={r} />
                </span>
                <span className="hidden min-w-0 md:block">
                  <StatusCell r={r} />
                </span>
                <span className="col-span-2 col-start-2 flex min-w-0 items-center justify-between gap-2 md:col-span-1 md:col-start-auto md:block">
                  <WhoCell r={r} canTake={canTake} />
                  <span className="md:hidden">
                    <DueCell r={r} />
                  </span>
                </span>
                <span className="hidden text-right md:block">
                  <MoneyCell r={r} />
                </span>
                <span className="hidden text-right md:block">
                  <DueCell r={r} />
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

/** «/» lleva al buscador. */
export function useSearchKey() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return ref;
}

export function ListControls({
  tab,
  setTab,
  q,
  setQ,
  inputRef,
  count,
  compact,
  actions,
}: {
  tab: ListTab;
  setTab: (t: ListTab) => void;
  q: string;
  setQ: (s: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  count: number;
  compact?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", compact && "flex-col items-stretch")}>
      {actions}
      <label className="flex h-[38px] min-w-[220px] flex-1 items-center gap-2 rounded-md border bg-surface px-3 text-muted focus-within:border-muted">
        <Search className="size-4 shrink-0" strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código, cliente o curso"
          aria-label="Buscar trabajos"
          className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
        />
        {q ? (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")} className="grid size-6 place-items-center rounded text-muted hover-fine:hover:text-fg">
            <X className="size-3.5" />
          </button>
        ) : (
          !compact && <Kbd className="hidden md:inline-flex">/</Kbd>
        )}
      </label>
      <div role="tablist" aria-label="Qué trabajos ver" className="flex gap-0.5">
        {(
          [
            ["curso", `En curso ${count}`],
            ["finalizados", "Finalizados"],
            ["todos", "Todos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("press h-[34px] rounded-md px-3 text-[13px] font-medium transition-colors duration-150", tab === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lista compacta: panel que sale de la derecha y celular (RF-12). */
export function JobListCompact({ rows, activeCode, canTake, onPick }: { rows: JobRow[]; activeCode?: string; canTake: boolean; onPick?: () => void }) {
  const [tab, setTab] = useState<ListTab>("curso");
  const [q, setQ] = useState("");
  const visible = filterRows(rows, tab, q);
  const groups = groupRows(visible, tab);
  const count = useMemo(() => filterRows(rows, "curso", "").length, [rows]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3">
        <ListControls tab={tab} setTab={setTab} q={q} setQ={setQ} count={count} compact />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto border-t border-line pb-4">
        {groups.length === 0 && <p className="px-5 py-10 text-center text-sm text-faint">No hay trabajos aquí.</p>}
        {groups.map((g) => (
          <div key={g.key}>
            <p className={cn("px-4 pt-3 pb-1 font-mono text-[11px]", g.tone === "danger" ? "text-danger" : "text-muted")}>{g.label}</p>
            {g.rows.map((r) => (
              <Link
                key={r.id}
                href={`/trabajos/${r.code}`}
                onClick={onPick}
                aria-current={r.code === activeCode ? "page" : undefined}
                className={cn("row grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[3px] px-4 py-2.5", r.code === activeCode && "bg-hover")}
              >
                <Dot tone={rowTone(r)} />
                <span className="truncate text-sm font-medium">{r.title}</span>
                <MoneyCell r={r} />
                <span />
                <span className="truncate text-xs text-muted">
                  {r.code} · {r.clientName}
                </span>
                <DueCell r={r} />
                {!r.responsibleId && !r.externoId && ["confirmado", "en_proceso", "correcciones"].includes(r.status) && (
                  <>
                    <span />
                    <span className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-warning">Por tomar</span>
                      {canTake && <TakeButton jobId={r.id} size="sm" />}
                    </span>
                    <span />
                  </>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
