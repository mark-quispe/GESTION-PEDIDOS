"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { correctPayment, setReviewed } from "@/actions/payments";
import type { PaymentRow } from "@/lib/queries/payments";
import { METHOD_LABEL, METHODS, round2 } from "@/lib/domain";
import { addDays, dayKey, dayLabel, dayMonth, timeLima, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import type { PaymentMethod } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { VoidPaymentDialog } from "@/components/jobs/job-file-dialogs";

export type Period = "dia" | "semana" | "mes";
type Filter = "todos" | PaymentMethod | "revisar" | "precios";
type Change = { id: string; jobId: string | null; at: string; who: string | null; summary: string | null; code: string; client: string };

export function PaymentsBoard({
  rows,
  changes,
  period,
  day,
  from,
  to,
  today,
  initialFilter,
}: {
  rows: PaymentRow[];
  changes: Change[];
  period: Period;
  day: string;
  from: string;
  to: string;
  today: string;
  initialFilter: Filter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selId, setSelId] = useState<string | null>(null);
  const [, start] = useTransition();
  const [reviewed, setOptimistic] = useOptimistic(
    Object.fromEntries(rows.map((r) => [r.id, !!r.reviewedAt])) as Record<string, boolean>,
    (s, p: { id: string; v: boolean }) => ({ ...s, [p.id]: p.v }),
  );

  const go = (p: Period, d: string) => router.push(`/pagos?p=${p}&d=${d}`);
  const step = (dir: 1 | -1) => {
    if (period === "dia") return go(period, addDays(day, dir));
    if (period === "semana") return go(period, addDays(day, 7 * dir));
    const d = new Date(`${day.slice(0, 8)}01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + dir);
    go(period, d.toISOString().slice(0, 10));
  };
  const label =
    period === "dia"
      ? `${dayLabel(day)} ${new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "").toLowerCase()}`
      : period === "semana"
        ? `${dayMonth(`${from}T12:00:00-05:00`)} – ${dayMonth(`${addDays(to, -1)}T12:00:00-05:00`)}`
        : new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${from}T12:00:00Z`)).toLowerCase();

  const live = rows.filter((r) => !r.voidedAt);
  const done = live.filter((r) => reviewed[r.id]).length;
  const toReview = round2(live.filter((r) => !reviewed[r.id]).reduce((a, r) => a + (r.kind === "devolucion" ? -r.amount : r.amount), 0));
  const net = round2(live.reduce((a, r) => a + (r.kind === "devolucion" ? -r.amount : r.amount), 0));
  const visible = rows.filter((r) => (filter === "todos" ? true : filter === "revisar" ? !reviewed[r.id] && !r.voidedAt : filter === "precios" ? false : r.method === filter));
  const sel = rows.find((r) => r.id === selId) ?? null;

  const toggle = (r: PaymentRow) =>
    start(async () => {
      const v = !reviewed[r.id];
      setOptimistic({ id: r.id, v });
      const res = await setReviewed(r.id, v);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });

  return (
    <div className="flex min-h-0 flex-1 gap-5">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="mb-1.5 font-mono text-xs text-muted">05 · Pagos</p>
            <h1 className="text-[28px] leading-tight font-medium tracking-[-0.025em] md:text-[30px]">Pagos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Periodo" className="flex gap-0.5 rounded-[7px] border bg-bg p-0.5">
              {(
                [
                  ["dia", "Día"],
                  ["semana", "Semana"],
                  ["mes", "Mes"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={period === k} onClick={() => go(k, day)} className={cn("press h-8 rounded-[5px] px-3 text-[13px] font-medium", period === k ? "bg-line" : "text-muted")}>
                  {l}
                </button>
              ))}
            </div>
            <Button size="icon" aria-label="Anterior" onClick={() => step(-1)}>
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center font-mono text-[13px]">{label}</span>
            <Button size="icon" aria-label="Siguiente" onClick={() => step(1)} disabled={from >= today && period === "dia"}>
              <ChevronRight />
            </Button>
            {day !== today && (
              <Button size="md" onClick={() => go(period, todayLima())}>
                Hoy
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="rounded-lg border bg-surface px-4 py-3">
            <p className="text-[13px] text-muted">
              Revisados contra Yape y banco{" "}
              <span className="font-mono text-fg">
                {done} de {live.length}
              </span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-fg transition-[width] duration-500 ease-(--ease-out)" style={{ width: `${live.length ? (done / live.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="rounded-lg border bg-surface px-4 py-3">
            <p className="font-mono text-[11px] text-muted">Por revisar</p>
            <p className="mt-0.5 font-mono text-lg text-warning">{formatMoney(toReview)}</p>
          </div>
          <div className="rounded-lg border bg-surface px-4 py-3">
            <p className="font-mono text-[11px] text-muted">Neto del {period === "dia" ? "día" : period === "semana" ? "periodo" : "mes"}</p>
            <p className="mt-0.5 font-mono text-lg">{formatMoney(net)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["todos", "Todos"],
              ...METHODS.map((m) => [m, METHOD_LABEL[m]] as const),
              ["revisar", "Por revisar"],
              ["precios", `Precios cambiados${changes.length ? ` ${changes.length}` : ""}`],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("press h-8 rounded-md px-3 text-[13px] font-medium transition-colors duration-150", filter === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}>
              {l}
            </button>
          ))}
          <Button size="sm" className="ml-auto" asChild>
            <a href={`/api/export?tabla=pagos&desde=${from}&hasta=${addDays(to, -1)}`}>
              <Download /> Exportar
            </a>
          </Button>
        </div>

        {filter === "precios" ? (
          <div className="enter overflow-hidden rounded-lg border bg-surface">
            {changes.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-faint">Sin cambios de precio en este periodo.</p>}
            {changes.map((c) => (
              <Link key={c.id} href={`/trabajos/${c.code}`} className="row grid grid-cols-[110px_90px_minmax(0,1fr)] gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0">
                <span className="font-mono text-xs text-muted">
                  {dayMonth(c.at)} {timeLima(c.at)}
                </span>
                <span className="font-mono text-xs">{c.code}</span>
                <span className="min-w-0">
                  <span className="text-muted">{c.who} </span>
                  {c.summary}
                  <span className="block text-xs text-faint">{c.client}</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="enter overflow-x-auto rounded-lg border bg-surface">
            <div className="grid min-w-[680px] grid-cols-[36px_64px_minmax(0,1.4fr)_minmax(0,1fr)_120px] gap-3 border-b px-4 py-2.5 font-mono text-[10.5px] text-muted">
              <span />
              <span>{period === "dia" ? "Hora" : "Fecha"}</span>
              <span>Cliente · trabajo</span>
              <span>Medio · operación</span>
              <span className="text-right">Monto</span>
            </div>
            {visible.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-faint">{rows.length ? "Nada con este filtro." : "Sin pagos en este periodo."}</p>}
            {visible.map((r) => {
              const refund = r.kind === "devolucion";
              const voided = !!r.voidedAt;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelId(r.id)}
                  className={cn("row grid min-w-[680px] cursor-pointer grid-cols-[36px_64px_minmax(0,1.4fr)_minmax(0,1fr)_120px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0", selId === r.id && "bg-hover", voided && "opacity-55")}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!reviewed[r.id]}
                    aria-label={reviewed[r.id] ? "Quitar revisado" : "Marcar revisado"}
                    disabled={voided}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(r);
                    }}
                    className={cn(
                      "check grid size-6 place-items-center rounded-md border transition-colors duration-150",
                      reviewed[r.id] ? "border-success-line bg-success-soft text-success" : "border-border-strong text-transparent hover-fine:hover:border-muted",
                    )}
                  >
                    <Check className={cn("size-3.5", reviewed[r.id] && "check-mark")} strokeWidth={2.5} />
                  </button>
                  <span className="font-mono text-xs text-muted">{period === "dia" ? timeLima(r.paidAt) : dayMonth(r.paidAt)}</span>
                  <span className={cn("min-w-0", voided && "line-through")}>
                    <span className="block truncate text-sm font-medium">
                      {r.client}
                      {refund && <span className="ml-1.5 text-xs font-normal text-danger">Devolución</span>}
                      {r.label?.startsWith("extra") && <span className="ml-1.5 text-xs font-normal text-warning">{r.label}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {r.code} · {r.createdBy ?? "—"}
                      {refund && r.reason && <span className="text-faint"> · Motivo: {r.reason}</span>}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px]">{METHOD_LABEL[r.method]}</span>
                    <span className="block font-mono text-xs text-faint">{r.operationNumber ?? "—"}</span>
                  </span>
                  <span className={cn("text-right font-mono text-sm", refund && "text-danger", voided && "line-through")}>
                    {refund ? "− " : ""}
                    {formatMoney(r.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-faint">Marca la casilla cuando el pago aparece en tu app o en el banco. Si no cuadra, ábrelo y corrígelo.</p>
      </section>

      {sel && <Detail key={sel.id} r={sel} reviewed={!!reviewed[sel.id]} onClose={() => setSelId(null)} onToggle={() => toggle(sel)} />}
    </div>
  );
}

function Detail({ r, reviewed, onClose, onToggle }: { r: PaymentRow; reviewed: boolean; onClose: () => void; onToggle: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ver" | "corregir">("ver");
  const [voiding, setVoiding] = useState(false);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(r.amount);
  const [method, setMethod] = useState<PaymentMethod>(r.method);
  const [date, setDate] = useState(dayKey(r.paidAt));
  const [op, setOp] = useState(r.operationNumber ?? "");
  const [reason, setReason] = useState("");
  const refund = r.kind === "devolucion";
  const delta = round2((amount - r.amount) * (refund ? -1 : 1));
  const newPending = round2(r.jobPending - delta);

  const save = () =>
    start(async () => {
      const res = await correctPayment({ paymentId: r.id, amount, method, paidDate: date, operationNumber: op, reason });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Pago corregido. El valor anterior quedó en el historial.");
      setMode("ver");
      router.refresh();
    });

  return (
    <aside className="sheet fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l bg-surface shadow-[0_0_60px_rgba(0,0,0,0.4)] xl:static xl:z-auto xl:max-w-[360px] xl:rounded-lg xl:border xl:shadow-none" data-state="open">
      <header className="flex items-start justify-between border-b px-4 py-3.5">
        <div>
          <p className="font-mono text-[11px] text-muted">05 · Pagos · {mode === "ver" ? "detalle" : "corregir"}</p>
          <h2 className="text-lg font-medium">{mode === "ver" ? `Detalle ${refund ? "de la devolución" : "del pago"}` : "Corregir pago"}</h2>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="press grid size-8 place-items-center rounded-md text-muted hover-fine:hover:bg-hover">
          <X className="size-4" />
        </button>
      </header>
      {mode === "ver" ? (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="rounded-lg border bg-bg px-3.5 py-3">
            <p className="flex items-center justify-between text-[13px] text-muted">
              {refund ? "Devolución" : "Pago"} · {METHOD_LABEL[r.method]}
              <button type="button" onClick={onToggle} disabled={!!r.voidedAt} className={cn("press inline-flex items-center gap-1 text-xs", reviewed ? "text-success" : "text-warning")}>
                {reviewed ? (
                  <>
                    <Check className="size-3.5" /> Revisado
                  </>
                ) : (
                  "Por revisar · marcar"
                )}
              </button>
            </p>
            <p className={cn("mt-1 font-mono text-2xl", refund && "text-danger", r.voidedAt && "line-through")}>
              {refund ? "− " : ""}
              {formatMoney(r.amount)}
            </p>
            <Link href={`/trabajos/${r.code}`} className="text-[13px] text-info">
              {r.code} · {r.client}
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <Item k="Fecha y hora" v={`${dayLabel(dayKey(r.paidAt))} · ${timeLima(r.paidAt)}`} />
            <Item k="N.º de operación" v={r.operationNumber ?? "—"} mono />
            <Item k="Tipo" v={r.label ?? (refund ? "Devolución" : "Pago")} />
            <Item k="Registró" v={r.createdBy ?? "—"} />
            <Item k="Pendiente del trabajo" v={r.jobPending > 0 ? formatMoney(r.jobPending) : `${formatMoney(0)} · pagado`} tone={r.jobPending > 0 ? "text-warning" : "text-success"} />
            <Item k="Precio" v={formatMoney(r.jobTotal)} />
          </dl>
          {refund && r.reason && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">Motivo: {r.reason}</p>}
          {r.voidedAt && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              Anulado por {r.voidedBy} · {dayMonth(r.voidedAt)} · «{r.voidReason}»
            </p>
          )}
          {r.receiptLink ? (
            <a href={r.receiptLink} target="_blank" rel="noreferrer" className="row flex items-center justify-between rounded-lg border px-3 py-2.5 text-[13px]">
              Captura en Drive · {r.code} / Pagos <ExternalLink className="size-3.5 text-muted" />
            </a>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-2.5 text-xs text-faint">Sin captura del comprobante.</p>
          )}
          <div>
            <p className="mb-2 font-mono text-[11px] text-muted">Historial del pago</p>
            <ol className="flex flex-col gap-2.5 border-l border-line pl-3.5 text-[13px]">
              <li className="relative">
                <span className="absolute top-1.5 -left-[18px] size-1.5 rounded-full bg-fg" />
                Registrado por <b className="font-medium">{r.createdBy ?? "—"}</b>
                <span className="block text-xs text-faint">
                  {dayMonth(r.createdAt)} {timeLima(r.createdAt)}
                </span>
              </li>
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute top-1.5 -left-[18px] size-1.5 rounded-full", h.summary.includes("revisado") ? "bg-success" : h.summary.includes("anuló") ? "bg-danger" : "bg-muted")} />
                  <b className="font-medium">{h.who ?? "—"}</b> {h.summary}
                  <span className="block text-xs text-faint">
                    {dayMonth(h.at)} {timeLima(h.at)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <p className="text-[13px] text-muted">
            <Link href={`/trabajos/${r.code}`} className="text-info">
              {r.code} · {r.client}
            </Link>
            . El valor anterior queda guardado en el historial.
          </p>
          <Field label="Monto" aside={<span className="font-mono text-[11px] text-faint">antes {formatMoney(r.amount)}</span>}>
            <Stepper label="Monto" value={amount} prefix="S/" step={1} decimals={2} onChange={setAmount} />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Medio">
            <Choice label="Medio" value={method} onChange={setMethod} cols={2} options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} size="sm" />
          </Field>
          <Field label="N.º de operación">
            <Input value={op} onChange={(e) => setOp(e.target.value)} className="font-mono" />
          </Field>
          {delta !== 0 && (
            <p className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs">
              <span className="text-warning">Cambia lo pendiente del trabajo.</span> {r.code} quedaría con {newPending >= 0 ? `${formatMoney(newPending)} pendientes` : `${formatMoney(-newPending)} pagados de más`}.
            </p>
          )}
          <Field label="Motivo de la corrección · obligatorio">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="En Yape figura otro monto…" className="min-h-16" />
          </Field>
        </div>
      )}
      <footer className="flex justify-end gap-2 border-t px-4 py-3">
        {mode === "ver" ? (
          !r.voidedAt && (
            <>
              <Button size="md" variant="danger" onClick={() => setVoiding(true)}>
                Anular {refund ? "devolución" : "pago"}
              </Button>
              <Button size="md" onClick={() => setMode("corregir")}>
                Corregir
              </Button>
            </>
          )
        ) : (
          <>
            <Button size="md" onClick={() => setMode("ver")}>
              Cancelar
            </Button>
            <Button size="md" variant="primary" onClick={save} disabled={pending || reason.trim().length < 3}>
              Guardar corrección
            </Button>
          </>
        )}
      </footer>
      <VoidPaymentDialog payment={voiding ? { id: r.id, amount: r.amount, label: refund ? "Devolución" : "Pago" } : null} onClose={() => setVoiding(false)} />
    </aside>
  );
}

function Item({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] text-muted">{k}</dt>
      <dd className={cn("mt-0.5 truncate", mono && "font-mono", tone)}>{v}</dd>
    </div>
  );
}
