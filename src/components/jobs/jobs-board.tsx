"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Ban, CalendarDays, ChevronRight, CircleCheck, CircleDashed, Clock3, Coins, FileText, Flag, LayoutGrid, Layers, Search, UserRound, X } from "lucide-react";
import type { JobRow } from "@/lib/queries/jobs";
import { normalizeText, STATUS_SHORT } from "@/lib/domain";
import { addDays, dayKey, dueLabel, todayLima, weekStart } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { Avatar, TakeButton } from "@/components/jobs/bits";
import { JobActionButtons } from "@/components/jobs/job-buttons";
import { useSearchKey } from "@/components/jobs/job-list";
import { Kbd } from "@/components/jobs/bits";

type Filter = "todos" | "curso" | "tomar" | "atrasados" | "terminados" | "finalizados";

const isClosed = (r: JobRow) => r.status === "finalizado" || r.status === "cancelado";
const isPool = (r: JobRow) => !r.responsibleId && !r.externoId && ["confirmado", "en_proceso", "correcciones"].includes(r.status);

const FILTERS: { k: Filter; label: string; icon: ReactNode; test: (r: JobRow) => boolean }[] = [
  { k: "todos", label: "Todos", icon: <LayoutGrid className="size-[18px]" />, test: () => true },
  { k: "curso", label: "En curso", icon: <Layers className="size-[18px]" />, test: (r) => !isClosed(r) },
  { k: "tomar", label: "Por tomar", icon: <Clock3 className="size-[18px] text-warning" />, test: isPool },
  { k: "atrasados", label: "Atrasados", icon: <AlertCircle className="size-[18px] text-danger" />, test: (r) => r.late },
  { k: "terminados", label: "Terminados", icon: <CircleCheck className="size-[18px] text-success" />, test: (r) => r.status === "terminado" },
  { k: "finalizados", label: "Finalizados", icon: <Flag className="size-[18px] text-muted" />, test: (r) => isClosed(r) },
];

type Group = { key: string; label: string; danger?: boolean; rows: JobRow[] };

function groups(rows: JobRow[]): Group[] {
  const endOfWeek = addDays(weekStart(todayLima()), 6);
  const open = rows.filter((r) => !isClosed(r)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const closed = rows.filter(isClosed).sort((a, b) => (b.finishedAt ?? b.dueAt).localeCompare(a.finishedAt ?? a.dueAt));
  return [
    { key: "late", label: "Atrasados", danger: true, rows: open.filter((r) => r.late) },
    { key: "week", label: "Esta semana", rows: open.filter((r) => !r.late && dayKey(r.dueAt) <= endOfWeek) },
    { key: "next", label: "Próximos", rows: open.filter((r) => !r.late && dayKey(r.dueAt) > endOfWeek) },
    { key: "closed", label: "Finalizados y cancelados", rows: closed },
  ].filter((g) => g.rows.length > 0);
}

/* ---------- Celdas ---------- */

function dotClass(r: JobRow) {
  if (r.late) return "bg-danger";
  if (isPool(r) || r.status === "cotizacion" || r.status === "correcciones") return "bg-warning";
  if (r.status === "en_proceso" || r.status === "en_revision") return "bg-info";
  if (r.status === "terminado") return "bg-fg";
  if (r.status === "finalizado") return "bg-success";
  return "bg-faint";
}

function Estado({ r }: { r: JobRow }) {
  const st = r.status;
  const look =
    st === "en_proceso" || st === "en_revision"
      ? { cls: "border-info-line bg-info-soft text-info", icon: <CircleDashed className="size-4" strokeWidth={2} /> }
      : st === "terminado" || st === "finalizado"
        ? { cls: "border-success-line bg-success-soft text-success", icon: <CircleCheck className="size-4" strokeWidth={2} /> }
        : st === "cotizacion" || st === "correcciones"
          ? { cls: "border-warning-line bg-warning-soft text-warning", icon: <FileText className="size-4" strokeWidth={2} /> }
          : st === "cancelado"
            ? { cls: "text-faint", icon: <Ban className="size-4" strokeWidth={2} /> }
            : { cls: "text-fg-2", icon: <CircleCheck className="size-4" strokeWidth={2} /> };
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className={cn("inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[13px] whitespace-nowrap", look.cls)}>
        {look.icon}
        <span className="truncate" title={STATUS_SHORT[st]}>{st === "terminado" ? "Terminado" : STATUS_SHORT[st]}</span>
      </span>
      {isPool(r) && r.itemsDone > 0 && r.itemsDone < r.itemsTotal && <span className="pl-1 text-xs text-warning">falta {r.itemsTotal - r.itemsDone} de {r.itemsTotal}</span>}
    </span>
  );
}

function Asignado({ r, canTake }: { r: JobRow; canTake: boolean }) {
  const name = r.externoName ?? r.responsibleName;
  if (name)
    return (
      <span className="inline-flex min-w-0 items-center gap-2.5 text-sm text-fg-2">
        <Avatar name={name} ext={!!r.externoName} className="size-7 text-[10px]" />
        <span className="truncate">{r.externoName ? `${name.split(" ")[0]} · externo` : name}</span>
      </span>
    );
  if (isPool(r))
    return (
      <span className="reveal inline-flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-warning">
          <UserRound className="size-[18px]" strokeWidth={1.8} />
          Por tomar
        </span>
        {canTake && (
          <span className="act">
            <TakeButton jobId={r.id} />
          </span>
        )}
      </span>
    );
  return <span className="text-sm text-faint">—</span>;
}

function Pago({ r }: { r: JobRow }) {
  if (r.status === "cancelado") return <span className="text-sm text-faint">—</span>;
  if (r.status !== "cotizacion" && r.pending <= 0.004)
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-success-line bg-success-soft px-2.5 text-[13px] text-success">
        <CircleCheck className="size-4" strokeWidth={2} />
        Pagado
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap tabular-nums", r.status === "cotizacion" && "font-normal text-muted")}>
      <Coins className="size-[18px] text-muted" strokeWidth={1.8} />
      {formatMoney(r.status === "cotizacion" ? r.total : r.pending)}
    </span>
  );
}

function Entrega({ r }: { r: JobRow }) {
  const today = dayKey(r.dueAt) === todayLima();
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm whitespace-nowrap", today && !r.late && !isClosed(r) ? "text-warning" : "text-fg-2")}>
      <CalendarDays className="size-[18px] text-muted" strokeWidth={1.8} />
      {isClosed(r) ? dueLabel(r.finishedAt ?? r.dueAt) : dueLabel(r.dueAt)}
    </span>
  );
}

const GRID = "md:grid-cols-[10px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_118px_96px_14px] 2xl:grid-cols-[10px_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_130px_110px_14px]";

/* ---------- Pantalla ---------- */

export type LastViewed = { code: string; title: string } | null;

/** Trabajos (RF-12), con la distribución que pidió Mark el 27/11. */
export function JobsBoard({ rows, canTake, last, initialQ = "", respName, isAdmin }: { rows: JobRow[]; canTake: boolean; last: LastViewed; initialQ?: string; respName?: string | null; isAdmin: boolean }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState(initialQ);
  const [allClosed, setAllClosed] = useState(false);
  const search = useSearchKey();
  const count = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.k, rows.filter(f.test).length])) as Record<Filter, number>, [rows]);
  const term = normalizeText(q);
  const test = FILTERS.find((f) => f.k === filter)!.test;
  const visible = rows.filter((r) => test(r) && (!term || normalizeText(`${r.code} ${r.clientName} ${r.course ?? ""} ${r.title} ${r.clientPhone}`).includes(term)));
  const gs = groups(visible);

  const today = todayLima();
  const upcoming = rows
    .filter((r) => !isClosed(r) && r.status !== "cotizacion" && !r.late && dayKey(r.dueAt) <= addDays(today, 1))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const toCollect = rows.filter((r) => r.status !== "cancelado" && r.status !== "cotizacion" && r.pending > 0.004).sort((a, b) => b.pending - a.pending);
  const toCollectTotal = toCollect.reduce((a, r) => a + r.pending, 0);

  const kpis: { k: Filter; label: string; icon: ReactNode }[] = [
    { k: "curso", label: "En curso", icon: <Layers className="size-6 text-muted" strokeWidth={1.6} /> },
    { k: "tomar", label: "Por tomar", icon: <Clock3 className="size-6 text-warning" strokeWidth={1.6} /> },
    { k: "atrasados", label: "Atrasados", icon: <AlertCircle className="size-6 text-danger" strokeWidth={1.6} /> },
    { k: "terminados", label: "Terminados", icon: <CircleCheck className="size-6 text-success" strokeWidth={1.6} /> },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_350px] [&_*]:leading-[normal]">
      <div className="flex min-w-0 flex-col gap-4">
        <header>
          <p className="font-mono text-[11px] text-muted">02 · Trabajos</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.025em]">Trabajos</h1>
          <p className="mt-1.5 text-[15px] text-muted">Todos los trabajos del estudio, organizados por estado y entrega.</p>
        </header>

        {last && (
          <Link href={`/trabajos/${last.code}`} className="press flex items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 xl:hidden">
            <span className="min-w-0">
              <span className="block text-[15px] font-medium">Seguir donde te quedaste</span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">
                {last.code} · {last.title}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <button
              key={k.k}
              onClick={() => setFilter(filter === k.k ? "todos" : k.k)}
              aria-pressed={filter === k.k}
              style={{ "--i": i } as React.CSSProperties}
              className={cn("enter press flex h-[50px] items-center gap-3.5 rounded-lg border bg-surface px-4 text-left transition-colors hover-fine:hover:border-border-strong", filter === k.k && "border-muted bg-line/60")}
            >
              {k.icon}
              <span className="flex-1 text-[15px]">{k.label}</span>
              <span className="number-pop text-[22px] font-medium tabular-nums">{count[k.k]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <JobActionButtons />
          <label className="flex h-[38px] min-w-[220px] flex-1 items-center gap-2.5 rounded-md border bg-surface px-3 text-muted focus-within:border-muted">
            <Search className="size-4 shrink-0" strokeWidth={1.8} />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Código, cliente o curso"
              aria-label="Buscar trabajos"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-muted"
            />
            {q ? (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")} className="grid size-6 place-items-center rounded text-muted hover-fine:hover:text-fg">
                <X className="size-3.5" />
              </button>
            ) : (
              <Kbd className="hidden md:inline-flex">/</Kbd>
            )}
          </label>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] xl:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              aria-pressed={filter === f.k}
              className={cn("press inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm", filter === f.k ? "border-muted bg-line text-fg" : "bg-surface text-fg-2")}
            >
              {f.icon}
              {f.label}
              <span className="text-muted tabular-nums">{count[f.k]}</span>
            </button>
          ))}
        </div>

        {respName && (
          <Link href="/trabajos" className="inline-flex h-[34px] items-center gap-2 self-start rounded-md border bg-surface px-3 text-[13px]">
            Solo de {respName} <span className="text-faint">· ver todos</span>
          </Link>
        )}

        {gs.length === 0 && <p className="rounded-lg border border-dashed px-5 py-12 text-center text-sm text-faint">{q ? `Nada coincide con «${q}».` : "No hay trabajos aquí."}</p>}
        {gs.map((g, gi) => (
          <section key={g.key} className="enter flex flex-col gap-2.5" style={{ "--i": gi + 4 } as React.CSSProperties}>
            <h2 className={cn("flex items-center gap-3 px-1 text-[18px] font-semibold", g.danger ? "text-danger" : "text-fg")}>
              {g.label}
              <span className={cn("grid h-7 min-w-7 place-items-center rounded-full px-2 text-[13px] font-medium", g.danger ? "bg-danger-soft text-danger" : "bg-line text-fg-2")}>{g.rows.length}</span>
            </h2>
            <div className="overflow-hidden rounded-xl border bg-surface/85">
            {(g.key === "closed" && !allClosed && filter !== "finalizados" ? g.rows.slice(0, 5) : g.rows).map((r) => (
              <Link
                key={r.id}
                href={`/trabajos/${r.code}`}
                className={cn("row grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-b-0 md:gap-x-4 md:gap-y-0 md:px-5 2xl:gap-x-5", GRID)}
              >
                <span className={cn("size-2.5 rounded-full", dotClass(r))} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{r.title}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {r.code} · {r.clientName}
                  </span>
                </span>
                <span className="text-right md:hidden">
                  <Pago r={r} />
                </span>
                <span className="hidden min-w-0 md:block">
                  <Estado r={r} />
                </span>
                <span className="col-span-2 col-start-2 flex min-w-0 items-center justify-between gap-2 md:col-span-1 md:col-start-auto md:block">
                  <Asignado r={r} canTake={canTake} />
                  <span className="md:hidden">
                    <Entrega r={r} />
                  </span>
                </span>
                <span className="hidden md:block">
                  <Pago r={r} />
                </span>
                <span className="hidden md:block">
                  <Entrega r={r} />
                </span>
                <ChevronRight className="hidden size-4 text-muted md:block" />
              </Link>
            ))}
            {g.key === "closed" && !allClosed && filter !== "finalizados" && g.rows.length > 5 && (
              <button onClick={() => setAllClosed(true)} className="row w-full px-5 py-2.5 text-left text-sm text-muted hover-fine:hover:text-fg">
                Ver los {g.rows.length} finalizados y cancelados
              </button>
            )}
            </div>
          </section>
        ))}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 xl:pt-[52px]">
        {last && (
          <Link href={`/trabajos/${last.code}`} className="enter press group hidden items-center xl:flex justify-between gap-3 rounded-lg border bg-surface px-4 py-3.5 hover-fine:hover:border-border-strong">
            <span className="min-w-0">
              <span className="block text-[16px] font-medium">Seguir donde te quedaste</span>
              <span className="mt-1 block truncate text-sm text-muted">
                {last.code} · {last.title}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
          </Link>
        )}

        <section className="enter hidden rounded-lg border bg-surface p-2.5 xl:block" style={{ "--i": 1 } as React.CSSProperties}>
          <h3 className="px-1.5 pt-1 pb-2.5 text-[16px] font-medium">Filtros rápidos</h3>
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              aria-pressed={filter === f.k}
              className={cn("row flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[15px]", filter === f.k ? "bg-line text-fg" : "text-fg-2")}
            >
              {f.icon}
              <span className="flex-1">{f.label}</span>
              <span className={cn("text-sm tabular-nums", filter === f.k ? "font-medium text-fg" : "text-muted")}>{count[f.k]}</span>
            </button>
          ))}
        </section>

        <section className="enter overflow-hidden rounded-lg border bg-surface" style={{ "--i": 2 } as React.CSSProperties}>
          <h3 className="flex justify-between border-b border-line px-4 py-3 text-[16px] font-medium">
            Entregas próximas <span className="text-sm font-normal text-muted">{upcoming.length}</span>
          </h3>
          {upcoming.length === 0 && <p className="px-4 py-5 text-center text-[13px] text-faint">Nada para hoy ni mañana.</p>}
          <div className="flex flex-col px-4 py-1">
            {upcoming.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/trabajos/${r.code}`} className="row -mx-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-1.5 py-2 last:border-b-0">
                <span className={cn("min-w-0 border-l-[3px] pl-3", dayKey(r.dueAt) === today ? "border-l-warning" : "border-l-border-strong")}>
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.code} · {r.clientName}
                  </span>
                </span>
                <span className={cn("text-[13px]", dayKey(r.dueAt) === today ? "text-warning" : "text-muted")}>{dueLabel(r.dueAt)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="enter overflow-hidden rounded-lg border bg-surface" style={{ "--i": 3 } as React.CSSProperties}>
          <h3 className="flex justify-between border-b border-line px-4 py-3 text-[16px] font-medium">
            Pendientes por cobrar <span className="text-sm font-normal text-muted tabular-nums">{isAdmin ? formatMoney(toCollectTotal) : toCollect.length}</span>
          </h3>
          {toCollect.length === 0 && <p className="px-4 py-5 text-center text-[13px] text-faint">Todo cobrado.</p>}
          <div className="flex flex-col px-4 py-1">
            {toCollect.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/trabajos/${r.code}`} className="row -mx-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-1.5 py-2 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.code} · {r.clientName}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(r.pending)}</span>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
