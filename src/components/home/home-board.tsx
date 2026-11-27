"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CircleCheck, ClipboardList, Clock, Coins, FileText, Search } from "lucide-react";
import type { Dashboard } from "@/lib/queries/dashboard";
import { addDays, dayKey, dayLabel, dueLabel, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { METHOD_LABEL, initials } from "@/lib/domain";
import { TakeButton } from "@/components/jobs/bits";
import { JobActionButtons } from "@/components/jobs/job-buttons";

const bar = { urgente: "border-l-danger", alta: "border-l-warning", normal: "border-l-border-strong" } as const;

/* ---------- Piezas ---------- */

function Panel({ icon, title, count, countTone, aside, children, className, footer }: { icon: ReactNode; title: string; count?: number; countTone?: "danger"; aside?: ReactNode; children: ReactNode; className?: string; footer?: ReactNode }) {
  return (
    <section className={cn("enter flex min-h-0 flex-col overflow-hidden rounded-xl border bg-surface", className)}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-3 text-[17px] font-semibold tracking-[-0.01em]">
          {icon}
          {title}
          {count !== undefined && (
            <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold", countTone === "danger" ? "bg-danger-soft text-danger ring-1 ring-danger-line" : "bg-line text-muted")}>{count}</span>
          )}
        </h2>
        {aside}
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </section>
  );
}

function Kpi({ href, icon, tone, label, value, delay, alert }: { href: string; icon: ReactNode; tone?: "danger" | "warning"; label: string; value: number; delay: number; alert?: number }) {
  return (
    <Link href={href} style={{ "--i": delay } as React.CSSProperties} className="enter press group flex min-w-0 items-center gap-2.5 rounded-xl border bg-surface px-3 py-3.5 2xl:gap-4 2xl:px-4 transition-colors hover-fine:hover:border-border-strong">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full 2xl:size-[52px] [&>svg]:size-5 2xl:[&>svg]:size-6", tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-line text-fg")}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] whitespace-nowrap text-muted 2xl:text-sm">{label}</span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("number-pop text-[26px] font-semibold tabular-nums", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>{value}</span>
          {!!alert && (
            <span title={`${alert} ya pasaron el plazo del aviso`} className="pop-in grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-on-primary">
              {alert}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="px-5 py-8 text-center text-[13px] text-faint">{children}</p>;

/* ---------- Inicio ---------- */

/** Inicio (RF-19, RF-49, RF-50) con la distribución que pidió Mark el 27/11: resumen arriba, agenda de la semana y listas a la derecha. */
export function HomeBoard({ d, canTake, admin }: { d: Dashboard; canTake: boolean; admin: boolean }) {
  const router = useRouter();
  const today = todayLima();
  const noon = new Date(`${today}T12:00:00-05:00`);
  const dateLine = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "long", timeZone: "America/Lima" }).format(noon);
  const [q, setQ] = useState("");
  const pool = [...d.pool].sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {dateLine.charAt(0).toUpperCase() + dateLine.slice(1).replace(".", ",")} <span className="mx-1.5">·</span> Semana {weekNumber(today)}
          </p>
          <h1 className="mt-1.5 text-[32px] font-semibold tracking-[-0.025em]">INICIO</h1>
          <p className="mt-1 text-[15px] text-muted">Aquí un resumen de tu estudio.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(q.trim() ? `/trabajos?q=${encodeURIComponent(q.trim())}` : "/trabajos");
            }}
            className="flex h-11 w-[360px] max-w-full items-center gap-2.5 rounded-lg border bg-bg/60 px-4 focus-within:border-muted"
          >
            <Search className="size-[18px] text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido, cliente o trabajo…" aria-label="Buscar pedido, cliente o trabajo" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </form>
          <JobActionButtons size="lg" long className="gap-4" />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_412px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:gap-5">
            <Kpi delay={0} href="/trabajos" icon={<ClipboardList className="size-6" />} label="Trabajos activos" value={d.active} />
            <Kpi delay={1} href="/trabajos" icon={<Clock className="size-6" />} tone="danger" label="Atrasados" value={d.late.length} />
            <Kpi delay={2} href="/trabajos" icon={<FileText className="size-6" />} label="Cotizaciones" value={d.quotes.length} />
            <Kpi delay={3} href="/trabajos" icon={<Coins className="size-6" />} tone="warning" label="Por cobrar" value={d.pending.rows.length} alert={d.alerts.pending} />
          </div>

          <WeekAgenda week={d.week} />

          <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-2">
            <DonePanel d={d} admin={admin} />
            <Panel icon={<Clock className="size-6 text-danger" />} title="Atrasados" count={d.late.length} countTone="danger" className="min-h-[200px]">
              {d.late.length === 0 && <Empty>Nada atrasado. Bien ahí.</Empty>}
              {d.late.map((r) => (
                <Line
                  key={r.id}
                  href={`/trabajos/${r.code}`}
                  code={r.code}
                  title={r.clientName}
                  sub={r.title}
                  right={
                    <span className="inline-flex h-7 items-center rounded-md border border-danger-line bg-danger-soft px-2.5 text-[13px] text-danger">
                      +{r.lateDays} {r.lateDays === 1 ? "día" : "días"}
                    </span>
                  }
                />
              ))}
            </Panel>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-5">
          <Panel
            icon={<CalendarDays className="size-6 text-muted" />}
            title="Trabajos"
            aside={<span className="text-sm text-muted">{d.pool.length} por tomar</span>}
            className="max-h-[420px] xl:max-h-none xl:flex-[0_1_auto]"
            footer={
              <Link href="/trabajos" className="group flex items-center justify-end gap-1.5 px-5 py-3 text-sm text-muted hover-fine:hover:text-fg">
                Ver todos en Trabajos <ArrowRight className="size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
              </Link>
            }
          >
            {pool.length === 0 && <Empty>No hay trabajos por tomar.</Empty>}
            {pool.slice(0, 6).map((r) => {
              const k = dayKey(r.dueAt);
              const hot = r.late || k <= addDays(today, 1);
              return (
                <Link key={r.id} href={`/trabajos/${r.code}`} className="reveal row grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-2.5">
                  <FileText className="size-[22px] text-muted" strokeWidth={1.6} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{r.title}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {r.code} · {r.clientName}
                      {r.itemsDone > 0 && r.itemsDone < r.itemsTotal && <span className="text-warning"> · falta {r.itemsTotal - r.itemsDone}</span>}
                    </span>
                  </span>
                  <span className="relative flex items-center">
                    {canTake && (
                      <span className="act mr-2 flex md:absolute md:top-1/2 md:right-[calc(100%+10px)] md:mr-0 md:-mt-3.5">
                        <TakeButton jobId={r.id} />
                      </span>
                    )}
                    {hot ? (
                      <span className={cn("inline-flex h-7 items-center rounded-md border px-2.5 text-[13px]", r.late ? "border-danger-line bg-danger-soft text-danger" : "border-warning-line bg-warning-soft text-warning")}>
                        {r.late ? `+${r.lateDays} ${r.lateDays === 1 ? "día" : "días"}` : dueLabel(r.dueAt, new Date(), k === today)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted">{dueLabel(r.dueAt)}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </Panel>

          <QuotesPanel d={d} admin={admin} />
        </div>
      </div>
    </div>
  );
}

function Line({ href, code, title, sub, right }: { href: string; code: string; title: string; sub: string; right: ReactNode }) {
  return (
    <Link href={href} className="row grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <span className="text-sm text-muted">{code}</span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="block truncate text-[13px] text-muted">{sub}</span>
      </span>
      {right}
    </Link>
  );
}

/* ---------- Agenda de la semana ---------- */

function WeekAgenda({ week }: { week: Dashboard["week"] }) {
  const [view, setView] = useState<"semana" | "hoy">("semana");
  const today = todayLima();
  const days = view === "hoy" ? week.filter((d) => d.day === today) : week;
  return (
    <section className="enter flex min-w-0 flex-col rounded-xl border bg-surface" style={{ "--i": 4 } as React.CSSProperties}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3.5 pb-3">
        <h2 className="flex items-center gap-3 whitespace-nowrap text-[17px] font-semibold tracking-[-0.01em]">
          <CalendarDays className="size-6 text-muted" strokeWidth={1.6} />
          Agenda de la semana
        </h2>
        <div role="radiogroup" aria-label="Vista de la agenda" className="inline-flex gap-0.5">
          {(["semana", "hoy"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn("press h-8 rounded-md px-4 text-sm font-medium capitalize transition-colors", view === v ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
            >
              {v}
            </button>
          ))}
          <Link href="/agenda" className="press inline-flex h-8 items-center rounded-md px-4 text-sm font-medium text-muted hover-fine:hover:text-fg">
            Mes
          </Link>
        </div>
      </header>
      <div className={cn("grid gap-2 px-2.5 pb-2.5", view === "hoy" ? "grid-cols-1" : "-mx-0 auto-cols-[150px] grid-flow-col overflow-x-auto md:auto-cols-auto md:grid-flow-row md:grid-cols-7")}>
        {days.map((d) => {
          const isToday = d.day === today;
          return (
            <div key={d.day} className={cn("flex h-[270px] min-w-0 flex-col gap-2 rounded-lg border bg-bg/50 p-2", isToday && "border-border-strong")}>
              <div className="flex items-center justify-between px-0.5">
                <span className="truncate text-[14px] font-semibold whitespace-nowrap 2xl:text-[15px]">{dayLabel(d.day)}</span>
                {isToday ? <span className="rounded-md bg-line px-2 py-0.5 text-xs font-medium">Hoy</span> : d.jobs.length ? <span className="text-xs text-muted">{d.jobs.length}</span> : null}
              </div>
              {d.jobs.length === 0 ? (
                <span className="m-auto text-sm text-muted">Libre</span>
              ) : (
                <div className={cn("scroll-thin flex min-h-0 flex-col gap-2 overflow-y-auto", view === "hoy" && "grid grid-cols-2 md:grid-cols-4")}>
                  {d.jobs.map((j) => (
                    <Link key={j.id} href={`/trabajos/${j.code}`} className={cn("row rounded-md border border-line border-l-[3px] bg-surface px-2 py-1.5", bar[j.urgency])}>
                      <p className="truncate font-mono text-[10.5px] whitespace-nowrap text-muted">
                        {j.time}<span className="hidden 2xl:inline"> · {j.code}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[13.5px]">{j.client}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function weekNumber(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
}

/* ---------- Carga | Cotizaciones (RF-50): el admin cambia con un clic; el empleado ve solo Cotizaciones ---------- */

function QuotesPanel({ d, admin }: { d: Dashboard; admin: boolean }) {
  const [tab, setTab] = useState<"carga" | "cotizaciones">("cotizaciones");
  const show = admin ? tab : "cotizaciones";
  const max = Math.max(1, ...d.load.map((l) => l.open));
  const head = admin ? (
    <div role="tablist" aria-label="Carga o cotizaciones" className="flex gap-0.5 rounded-lg border bg-bg p-[3px]">
      {(
        [
          ["carga", "Carga"],
          ["cotizaciones", "Cotizaciones"],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={tab === k}
          onClick={() => setTab(k)}
          className={cn("press inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors", tab === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
        >
          {label}
          {k === "cotizaciones" && d.quotes.length > 0 && <span className="font-mono text-xs text-warning">{d.quotes.length}</span>}
          {k === "cotizaciones" && !!d.alerts.quotes && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-on-primary">{d.alerts.quotes}</span>}
        </button>
      ))}
    </div>
  ) : null;
  return (
    <section className="enter flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-xl border bg-surface">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
        {head ?? (
          <h2 className="flex items-center gap-3 text-[17px] font-semibold tracking-[-0.01em]">
            <FileText className="size-6 text-muted" />
            Cotizaciones sin respuesta
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-line px-1.5 text-xs font-semibold text-muted">{d.quotes.length}</span>
          </h2>
        )}
        {admin && (
          <Link href="/trabajos" className="text-[13px] whitespace-nowrap text-muted hover-fine:hover:text-fg" title="Ver en Trabajos">
            <span className="hidden 2xl:inline">Ver en Trabajos </span>→
          </Link>
        )}
      </header>
      <div key={show} className="scroll-thin min-h-0 flex-1 overflow-y-auto" style={{ animation: "fade 160ms ease-out" }}>
        {show === "cotizaciones" ? (
          d.quotes.length === 0 ? (
            <Empty>No hay cotizaciones esperando.</Empty>
          ) : (
            d.quotes.map((r) => (
              <Link key={r.id} href={`/trabajos/${r.code}`} className="row mx-4 grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-3 last:border-b-0">
                <span className={cn("flex items-center self-stretch border-l-[3px] pl-3 text-sm text-muted", bar[r.urgency])}>{r.code}</span>
                <span className="truncate text-[15px] font-medium">{r.clientName}</span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold tabular-nums">{formatMoney(r.total)}</span>
                  <span className="block text-[13px] text-warning">{r.ageDays === 0 ? "hoy" : r.ageDays === 1 ? "ayer" : `hace ${r.ageDays} días`}</span>
                </span>
              </Link>
            ))
          )
        ) : d.load.length === 0 ? (
          <Empty>Nadie tiene trabajos tomados.</Empty>
        ) : (
          d.load.map((p) => (
            <Link key={p.id} href={`/trabajos?resp=${p.id}`} className="row grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
              <span className={cn("grid size-9 place-items-center rounded-full border bg-bg text-[11px] font-semibold", p.ext && "border-dashed")}>{initials(p.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">
                  {p.name}
                  {p.ext && <span className="ml-1.5 text-xs font-normal text-faint">externo</span>}
                </span>
                <span className="block truncate text-[13px] text-muted">Próxima: {p.next ? dueLabel(p.next, new Date(), true) : "—"}</span>
              </span>
              <span className="text-right">
                <span className="block text-[13px] text-muted">{p.open} en curso</span>
                <span className="mt-1 flex justify-end gap-[3px]">
                  {Array.from({ length: Math.min(6, p.open) }).map((_, i) => (
                    <span key={i} className="h-1 w-3 rounded-[2px] bg-fg" style={{ opacity: 0.35 + (0.65 * (i + 1)) / max }} />
                  ))}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------- Finalizados | Por cobrar | Pagos de hoy: lo del Inicio anterior sigue a un clic ---------- */

type DoneTab = "finalizados" | "cobrar" | "pagos";

function DonePanel({ d, admin }: { d: Dashboard; admin: boolean }) {
  const [tab, setTab] = useState<DoneTab>("finalizados");
  const tabs: { k: DoneTab; label: string; n?: number; alert?: number }[] = [
    { k: "finalizados", label: "Finalizados", n: d.finishedWeek.length },
    { k: "cobrar", label: "Por cobrar", n: d.pending.rows.length, alert: d.alerts.pending },
    ...(admin && d.money ? [{ k: "pagos" as const, label: "Pagos hoy", n: d.money.todayCount }] : []),
  ];
  return (
    <section className="enter flex min-h-[200px] flex-col overflow-hidden rounded-xl border bg-surface">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <span className="hidden size-6 shrink-0 place-items-center 2xl:grid">
          {tab === "finalizados" ? <CircleCheck className="size-6 text-success" /> : tab === "cobrar" ? <Coins className="size-6 text-warning" /> : <Coins className="size-6 text-muted" />}
        </span>
        <div role="tablist" aria-label="Qué ver" className="flex min-w-0 gap-0.5 overflow-x-auto rounded-lg border bg-bg p-[3px] [scrollbar-width:none]">
          {tabs.map((t) => (
            <button
              key={t.k}
              role="tab"
              aria-selected={tab === t.k}
              onClick={() => setTab(t.k)}
              className={cn("press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors 2xl:px-3 2xl:text-sm", tab === t.k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
            >
              {t.label}
              {t.n !== undefined && <span className={cn("font-mono text-xs", t.k === "cobrar" ? "text-warning" : "text-muted")}>{t.n}</span>}
              {!!t.alert && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-on-primary">{t.alert}</span>}
            </button>
          ))}
        </div>
      </header>
      <div key={tab} className="scroll-thin min-h-0 flex-1 overflow-y-auto" style={{ animation: "fade 160ms ease-out" }}>
        {tab === "finalizados" &&
          (d.finishedWeek.length === 0 ? (
            <Empty>Aún no se finalizó nada esta semana.</Empty>
          ) : (
            d.finishedWeek.map((r) => (
              <Line
                key={r.id}
                href={`/trabajos/${r.code}`}
                code={r.code}
                title={r.clientName}
                sub={r.title}
                right={
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px]">
                    <span className="size-1.5 rounded-full bg-success" />
                    {r.finishedAt ? dayLabel(dayKey(r.finishedAt)) : "—"}
                  </span>
                }
              />
            ))
          ))}
        {tab === "cobrar" && (
          <>
            {d.pending.rows.length === 0 && <Empty>Todo cobrado.</Empty>}
            {d.pending.rows.map((r) => {
              const over = r.finishedAgo !== null && r.finishedAgo >= d.alerts.pendingDays;
              return (
                <Line
                  key={r.id}
                  href={`/trabajos/${r.code}`}
                  code={r.code}
                  title={r.clientName}
                  sub={r.title}
                  right={
                    <span className="text-right">
                      <span className={cn("block text-[15px] font-semibold tabular-nums", over && "text-warning")}>{formatMoney(r.pending)}</span>
                      {over && <span className="block text-[13px] text-warning">finalizado hace {r.finishedAgo} días</span>}
                    </span>
                  }
                />
              );
            })}
            {admin && d.pending.rows.length > 0 && <p className="px-5 py-2.5 text-right text-[13px] text-muted">Total por cobrar: <span className="font-semibold text-warning tabular-nums">{formatMoney(d.pending.total)}</span></p>}
          </>
        )}
        {tab === "pagos" && d.money && (
          <>
            <div className="grid grid-cols-2 border-b border-line">
              <div className="px-5 py-3">
                <p className="text-[13px] text-muted">Hoy</p>
                <p className="mt-0.5 text-[22px] font-semibold tabular-nums">{formatMoney(d.money.today)}</p>
              </div>
              <div className="border-l border-line px-5 py-3">
                <p className="text-[13px] text-muted">Ingresos del mes</p>
                <p className="mt-0.5 text-[22px] font-semibold tabular-nums">{formatMoney(d.money.month)}</p>
              </div>
            </div>
            {d.money.todayPayments.length === 0 && <Empty>Hoy todavía no se registraron pagos.</Empty>}
            {d.money.todayPayments.map((p) => (
              <Line
                key={p.id}
                href={`/trabajos/${p.code}`}
                code={p.code}
                title={p.client}
                sub={[METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method, p.who].filter(Boolean).join(" · ")}
                right={<span className={cn("text-[15px] font-semibold tabular-nums", p.kind === "devolucion" && "text-danger")}>{p.kind === "devolucion" ? "−" : ""}{formatMoney(p.amount)}</span>}
              />
            ))}
            <Link href="/pagos" className="block px-5 py-2.5 text-right text-[13px] text-muted hover-fine:hover:text-fg">
              Ver todos los pagos →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
