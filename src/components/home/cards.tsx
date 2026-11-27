"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import { markSent } from "@/actions/jobs";
import type { Dashboard } from "@/lib/queries/dashboard";
import type { JobRow } from "@/lib/queries/jobs";
import { METHOD_LABEL, initials } from "@/lib/domain";
import { dayLabel, dueLabel, timeLima, todayLima, dayKey, addDays } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { Pill } from "@/components/ui/badge";
import { TakeButton } from "@/components/jobs/bits";
import type { PaymentMethod } from "@/db/schema";

/* ---------- Piezas comunes ---------- */

export function HomeCard({ title, aside, tone, children, className, footer, badge, style }: { title: ReactNode; aside?: ReactNode; tone?: "danger" | "warning"; children: ReactNode; className?: string; footer?: ReactNode; badge?: number; style?: React.CSSProperties }) {
  return (
    <section style={style} className={cn("enter flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface", className)}>
      <h2 className={cn("flex min-h-[45px] shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 text-sm font-medium", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>
        <span className="flex items-center gap-2">
          {title}
          {!!badge && <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10.5px] text-on-primary">{badge}</span>}
        </span>
        {aside !== undefined && <span className="font-mono text-xs font-normal text-muted">{aside}</span>}
      </h2>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </section>
  );
}

/** Fila del Inicio: código en mono (76 px), nombre y detalle, y algo a la derecha. Solo las cotizaciones llevan flecha. */
export function Row({ href, code, title, sub, right, className, chevron }: { href: string; code: string; title: string; sub: string; right?: ReactNode; className?: string; chevron?: boolean }) {
  return (
    <Link href={href} className={cn("row grid items-center gap-3 border-b border-line px-4 py-2.5", chevron ? "link-row grid-cols-[76px_minmax(0,1fr)_auto_14px]" : "grid-cols-[76px_minmax(0,1fr)_auto]", className)}>
      <span className="font-mono text-[11px] text-muted">{code}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="text-right">{right}</span>
      {chevron && <ChevronRight className="chev size-3.5 text-muted" />}
    </Link>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-5 text-center text-[13px] text-faint">{children}</p>;
}

/* ---------- Franja de la semana (RF-19) ---------- */

const urgBar = { urgente: "border-l-danger", alta: "border-l-warning", normal: "border-l-muted" } as const;

export function WeekStrip({ week }: { week: Dashboard["week"] }) {
  const today = todayLima();
  return (
    <section aria-label="Entregas de la semana" className="-mx-4 flex shrink-0 snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:h-[246px] md:grid-cols-7 md:overflow-visible md:px-0 [scrollbar-width:none]">
      {week.map((d, i) => {
        const isToday = d.day === today;
        const label = isToday ? "Hoy" : d.day === addDays(today, 1) ? "Mañana" : "";
        return (
          <div
            key={d.day}
            style={{ "--i": i } as React.CSSProperties}
            className={cn(
              "enter flex max-h-[246px] w-[150px] shrink-0 snap-start flex-col gap-1.5 overflow-hidden rounded-lg border border-t-2 p-2.5 md:h-full md:max-h-none md:w-auto md:min-w-0",
              isToday ? "border-t-fg bg-surface" : "border-t-border bg-surface-a",
            )}
          >
            <header className="flex items-baseline justify-between px-0.5 pb-0.5">
              <span className="text-[13px] font-medium">{dayLabel(d.day)}</span>
              <span className={cn("font-mono text-[11px]", isToday ? "text-fg" : "text-muted")}>
                {label} {d.jobs.length || "Libre"}
              </span>
            </header>
            <div className="scroll-thin flex min-h-0 flex-col gap-1.5 overflow-x-hidden overflow-y-auto">
              {d.jobs.map((j) => (
                <Link key={j.id} href={`/trabajos/${j.code}`} className={cn("row rounded-md border border-line border-l-2 bg-bg px-2 py-[7px]", urgBar[j.urgency])}>
                  <p className="font-mono text-[10.5px] whitespace-nowrap text-muted">
                    {j.time} · {j.code}
                  </p>
                  <p className="mt-0.5 truncate text-[13px]">{j.client}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PriorityLegend() {
  return (
    <div className="flex items-center justify-end gap-4 text-xs text-muted md:-my-2">
      <span className="font-mono text-[11px]">Prioridad</span>
      {(
        [
          ["bg-danger", "Urgente"],
          ["bg-warning", "Alta"],
          ["bg-border-strong", "Normal"],
        ] as const
      ).map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-0.5 rounded-[1px]", c)} />
          {l}
        </span>
      ))}
    </div>
  );
}

/* ---------- Tarjetas ---------- */

export function LateCard({ rows, className }: { rows: JobRow[]; className?: string }) {
  return (
    <HomeCard title="Atrasados" tone="danger" aside={rows.length} className={className}>
      {rows.length === 0 ? (
        <EmptyRow>Nada atrasado. Bien.</EmptyRow>
      ) : (
        rows.map((r) => (
          <Row key={r.id} href={`/trabajos/${r.code}`} code={r.code} title={r.clientName} sub={r.title} right={<Pill tone="danger">+{r.lateDays} {r.lateDays === 1 ? "día" : "días"}</Pill>} />
        ))
      )}
    </HomeCard>
  );
}

export function PendingCard({ data, badge, className }: { data: Dashboard["pending"]; badge?: number; className?: string }) {
  return (
    <HomeCard title="Pendientes por cobrar" tone="warning" aside={formatMoney(data.total)} badge={badge} className={className}>
      {data.rows.length === 0 ? (
        <EmptyRow>Todo cobrado.</EmptyRow>
      ) : (
        data.rows.map((r) => (
          <Row
            key={r.id}
            href={`/trabajos/${r.code}`}
            code={r.code}
            title={r.clientName}
            sub={r.title}
            right={
              <>
                <span className={cn("block font-mono text-[13px]", r.finishedAgo !== null && "text-warning")}>{formatMoney(r.pending)}</span>
                {r.finishedAgo !== null && <span className="block text-xs text-warning">finalizado hace {r.finishedAgo} {r.finishedAgo === 1 ? "día" : "días"}</span>}
              </>
            }
          />
        ))
      )}
    </HomeCard>
  );
}

function QuoteRows({ rows }: { rows: Dashboard["quotes"] }) {
  if (rows.length === 0) return <EmptyRow>No hay cotizaciones esperando.</EmptyRow>;
  return rows.map((r) => (
    <Row
      chevron
      key={r.id}
      href={`/trabajos/${r.code}`}
      code={r.code}
      title={r.clientName}
      sub={r.title}
      right={
        <>
          <span className="block font-mono text-[13px]">{formatMoney(r.total)}</span>
          <span className="block text-xs text-warning">{r.ageDays === 0 ? "hoy" : r.ageDays === 1 ? "ayer" : `hace ${r.ageDays} días`}</span>
        </>
      }
    />
  ));
}

export function QuotesCard({ rows, badge, className }: { rows: Dashboard["quotes"]; badge?: number; className?: string }) {
  return (
    <HomeCard title="Cotizaciones sin respuesta" aside={rows.length} badge={badge} className={className}>
      <QuoteRows rows={rows} />
    </HomeCard>
  );
}

/** RF-50: Carga | Cotizaciones en la misma tarjeta, se cambia con un clic. */
export function LoadQuotesCard({ load, quotes, badge, className }: { load: Dashboard["load"]; quotes: Dashboard["quotes"]; badge?: number; className?: string }) {
  const [tab, setTab] = useState<"carga" | "cotizaciones">(quotes.length ? "cotizaciones" : "carga");
  const max = Math.max(1, ...load.map((l) => l.open));
  return (
    <section className={cn("enter flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface", className)}>
      <h2 className="flex min-h-[45px] shrink-0 items-center justify-between gap-3 border-b py-2 pr-2.5 pl-4">
        <div role="tablist" aria-label="Carga o cotizaciones" className="flex gap-0.5 rounded-[7px] border bg-bg p-0.5">
          {(
            [
              ["carga", "Carga", null],
              ["cotizaciones", "Cotizaciones", quotes.length],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("press inline-flex h-[26px] items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors duration-150", tab === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
            >
              {label}
              {n ? <span className="font-mono text-[11px] text-warning">{n}</span> : null}
              {k === "cotizaciones" && !!badge && <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] text-on-primary">{badge}</span>}
            </button>
          ))}
        </div>
        <Link href="/trabajos" className="text-xs text-muted hover-fine:hover:text-fg">
          Ver en Trabajos →
        </Link>
      </h2>
      <div key={tab} className="scroll-thin min-h-0 flex-1 overflow-y-auto" style={{ animation: "fade 160ms ease-out" }}>
        {tab === "cotizaciones" ? (
          <QuoteRows rows={quotes} />
        ) : load.length === 0 ? (
          <EmptyRow>Nadie tiene trabajos tomados.</EmptyRow>
        ) : (
          load.map((p) => (
            <Link key={p.id} href={`/trabajos?resp=${p.id}`} className="row link-row grid grid-cols-[28px_minmax(0,1fr)_auto_14px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className={cn("grid size-7 place-items-center rounded-full border bg-bg text-[10px] font-semibold", p.ext && "border-dashed")}>{initials(p.name)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {p.name}
                  {p.ext && <span className="ml-1.5 text-xs font-normal text-faint">externo</span>}
                </span>
                <span className="block truncate text-xs text-muted">Próxima: {p.next ? `${dueLabel(p.next)} · ${timeLima(p.next)}` : "—"}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{p.open} en curso</span>
                <span className="flex gap-[3px]">
                  {Array.from({ length: Math.min(6, p.open) }).map((_, i) => (
                    <span key={i} className="h-3 w-1.5 rounded-[1px] bg-fg" style={{ opacity: 0.35 + (0.65 * (i + 1)) / max }} />
                  ))}
                </span>
              </span>
              <ChevronRight className="chev size-3.5 text-muted" />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

/** RF-49: tarjeta Trabajos (el pozo). Tomar aparece a la izquierda de la fecha al pasar el mouse. */
export function PoolCard({ pool, hot, canTake, className }: { pool: JobRow[]; hot: JobRow[]; canTake: boolean; className?: string }) {
  const hotIds = new Set(hot.map((h) => h.id));
  const rest = pool.filter((p) => !hotIds.has(p.id));
  return (
    <HomeCard title="Trabajos" aside={`${pool.length} por tomar`} className={className}>
      {hot.map((r) => (
        <Link key={r.id} href={`/trabajos/${r.code}`} className="row grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line px-4 py-[7px]">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{r.title}</span>
            <span className="mt-px block truncate text-xs text-muted">
              <span className="font-mono text-[11px]">{r.code}</span> · {r.clientName} · {r.responsibleName ?? r.externoName ?? <span className="text-warning">por tomar</span>}
            </span>
          </span>
          <Pill tone="danger">{r.late ? `+${r.lateDays} ${r.lateDays === 1 ? "día" : "días"}` : "Urgente"}</Pill>
        </Link>
      ))}
      {rest.length === 0 && hot.length === 0 && <EmptyRow>No hay trabajos por tomar.</EmptyRow>}
      {rest.map((r) => {
        const missing = r.itemsDone > 0 && r.itemsDone < r.itemsTotal;
        const soon = dayKey(r.dueAt) <= addDays(todayLima(), 1);
        const today = dayKey(r.dueAt) === todayLima();
        return (
          <Link key={r.id} href={`/trabajos/${r.code}`} className="reveal row grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line px-4 py-[7px]">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.title}</span>
              <span className="mt-px block truncate text-xs text-muted">
                <span className="font-mono text-[11px]">{r.code}</span> · {r.clientName}
                {missing && <span className="text-warning"> · falta {r.itemsTotal - r.itemsDone} de {r.itemsTotal}</span>}
              </span>
            </span>
            <span className="relative flex items-center">
              {canTake && (
                <span className="act absolute top-1/2 right-[calc(100%+10px)] -mt-3.5 flex">
                  <TakeButton jobId={r.id} />
                </span>
              )}
              <span className={cn("font-mono text-[11.5px]", soon || r.late ? "text-warning" : "text-muted")}>{dueLabel(r.dueAt, new Date(), today)}</span>
            </span>
          </Link>
        );
      })}
      <Link href="/trabajos" className="block px-4 py-2.5 text-right text-xs text-muted hover-fine:hover:text-fg">
        Ver todos en Trabajos →
      </Link>
    </HomeCard>
  );
}

/** RF-19: terminados por enviar, con el botón Enviado al cliente. */
export function ToSendCard({ rows, className }: { rows: JobRow[]; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <HomeCard title="Terminados por enviar" aside={rows.length} className={className}>
      {rows.length === 0 ? (
        <EmptyRow>Nada esperando envío.</EmptyRow>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="reveal row grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <Link href={`/trabajos/${r.code}`} className="font-mono text-[11px] text-muted">
              {r.code}
            </Link>
            <Link href={`/trabajos/${r.code}`} className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.clientName}</span>
              <span className="block truncate text-xs text-muted">{r.title}</span>
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await markSent(r.id);
                  if (!res.ok) toast.error(res.error);
                  else toast.success(`${r.code} enviado al cliente.`);
                  router.refresh();
                })
              }
              className="press inline-flex h-7 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-xs font-medium hover-fine:hover:border-border-strong"
            >
              <Send className="size-3" /> Enviado al cliente
            </button>
          </div>
        ))
      )}
    </HomeCard>
  );
}

export function FinishedWeekCard({ rows, className }: { rows: JobRow[]; className?: string }) {
  return (
    <HomeCard title="Finalizados esta semana" aside={rows.length} className={className}>
      {rows.length === 0 ? (
        <EmptyRow>Todavía ninguno esta semana.</EmptyRow>
      ) : (
        rows.map((r) => (
          <Row
            key={r.id}
            href={`/trabajos/${r.code}`}
            code={r.code}
            title={r.clientName}
            sub={r.title}
            right={
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs">
                <span className="size-1.5 rounded-full bg-success" />
                {r.finishedAt ? dayLabel(dayKey(r.finishedAt)) : ""}
              </span>
            }
          />
        ))
      )}
    </HomeCard>
  );
}

/* ---------- Dinero del admin (RF-20) ---------- */

export function MoneyCard({ money, className }: { money: NonNullable<Dashboard["money"]>; className?: string }) {
  const today = todayLima();
  const max = Math.max(100, ...money.byDay.map((d) => d.amount));
  const step = max > 1600 ? 500 : max > 800 ? 400 : 200;
  const top = Math.ceil(max / step) * step;
  const w = 340,
    h = 120,
    left = 36,
    bottom = 102;
  const n = money.byDay.length;
  const slot = (w - left) / n;
  const month = new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`)).toLowerCase();
  return (
    <section className={cn("enter flex flex-col overflow-hidden rounded-lg border bg-surface", className)}>
      <div className="grid grid-cols-2 border-b">
        <div className="border-r px-4 py-3.5">
          <p className="font-mono text-[11px] text-muted">Pagos de hoy</p>
          <p className="mt-1.5 text-2xl font-medium tracking-tight">{formatMoney(money.today)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {money.todayCount} {money.todayCount === 1 ? "movimiento" : "movimientos"}
          </p>
        </div>
        <div className="px-4 py-3.5">
          <p className="font-mono text-[11px] text-muted">Ingresos del mes</p>
          <p className="mt-1.5 text-2xl font-medium tracking-tight">{formatMoney(money.month)}</p>
          <p className="mt-0.5 text-xs text-muted">Pagos menos devoluciones</p>
        </div>
      </div>
      <div className="border-b px-4 pt-3.5 pb-2.5">
        <p className="mb-2 text-[13px] text-muted">Ingresos por día · {month}</p>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Ingresos por día de ${month}`}>
          {Array.from({ length: top / step + 1 }, (_, i) => {
            const v = i * step;
            const y = bottom - (v / top) * (bottom - 8);
            return (
              <g key={v}>
                <line x1={left} x2={w} y1={y} y2={y} stroke="var(--line)" />
                <text x={left - 8} y={y + 3} textAnchor="end" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="10">
                  {v}
                </text>
              </g>
            );
          })}
          {money.byDay.map((d, i) => {
            const x = left + i * slot + slot * 0.2;
            const bw = slot * 0.6;
            const bh = (Math.max(0, d.amount) / top) * (bottom - 8);
            const isToday = d.day === today;
            const label = (i + 1) % 4 === 1;
            return (
              <g key={d.day}>
                {bh > 0 && (
                  <rect x={x} y={bottom - bh} width={bw} height={bh} rx={Math.min(3, bw / 2)} fill={isToday ? "var(--fg)" : "var(--bar)"} className="grow-y" style={{ "--i": i } as React.CSSProperties}>
                    <title>{`${Number(d.day.slice(8))} · ${formatMoney(d.amount)}`}</title>
                  </rect>
                )}
                {label && (
                  <text x={x + bw / 2} y={h - 2} textAnchor="middle" fill="var(--muted)" fontFamily="var(--font-geist-mono)" fontSize="10">
                    {d.day.slice(8)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <h2 className="flex justify-between border-b px-4 py-3 text-sm font-medium">
        Pagos registrados hoy <span className="font-mono text-xs font-normal text-muted">{money.todayPayments.length}</span>
      </h2>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {money.todayPayments.length === 0 ? (
          <EmptyRow>Hoy todavía no hay pagos.</EmptyRow>
        ) : (
          money.todayPayments.map((p) => (
            <Link key={p.id} href={`/trabajos/${p.code}`} className="row grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-2.5">
              <span className="font-mono text-[11px] text-muted">{p.code}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.client}</span>
                <span className="block truncate text-xs text-muted">
                  {METHOD_LABEL[p.method as PaymentMethod]} · {p.who ?? "—"}
                </span>
              </span>
              <span className="text-right">
                <span className={cn("block font-mono text-[13px]", p.kind === "devolucion" && "text-danger")}>
                  {p.kind === "devolucion" ? "− " : ""}
                  {formatMoney(p.amount)}
                </span>
                <span className="block font-mono text-[11px] text-muted">{timeLima(p.at)}</span>
              </span>
            </Link>
          ))
        )}
      </div>
      <Link href="/pagos" className="mt-auto border-t border-line px-4 py-2.5 text-xs text-muted hover-fine:hover:text-fg">
        Ver todos los pagos →
      </Link>
    </section>
  );
}
