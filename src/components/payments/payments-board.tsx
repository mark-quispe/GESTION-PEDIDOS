"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { toast } from "sonner";
import { correctPayment, setReviewed } from "@/actions/payments";
import type { PaymentRow } from "@/lib/queries/payments";
import { METHOD_LABEL, METHODS, round2 } from "@/lib/domain";
import { addDays, dayKey, dayLabel, dayMonth, timeLima, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import type { PaymentMethod } from "@/db/schema";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { VoidPaymentDialog } from "@/components/jobs/job-file-dialogs";

export type Period = "dia" | "semana" | "mes";
type Filter = "todos" | PaymentMethod | "revisar" | "precios";
type Change = { id: string; jobId: string | null; at: string; who: string | null; summary: string | null; code: string; client: string };

const GRID = "grid-cols-[26px_52px_minmax(0,1fr)_150px_110px]";
const smallBtn = "press inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-[13px] font-medium whitespace-nowrap";

/** Pagos (RF-15, RF-16), igual al Design final «Pagos · revisar y ver detalle». */
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
  const [selId, setSelId] = useState<string | null>(rows.at(-1)?.id ?? null);
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
  const mon = (d: string) => new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)).replace(".", "").toLowerCase();
  const label =
    period === "dia"
      ? `${dayLabel(day)} ${mon(day)}`
      : period === "semana"
        ? `${dayMonth(`${from}T12:00:00-05:00`)} – ${dayMonth(`${addDays(to, -1)}T12:00:00-05:00`)}`
        : new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${from}T12:00:00Z`)).toLowerCase();

  const live = rows.filter((r) => !r.voidedAt);
  const done = live.filter((r) => reviewed[r.id]).length;
  const signed = (r: PaymentRow) => (r.kind === "devolucion" ? -r.amount : r.amount);
  const toReview = round2(live.filter((r) => !reviewed[r.id]).reduce((a, r) => a + signed(r), 0));
  const net = round2(live.reduce((a, r) => a + signed(r), 0));
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
    <div className="flex min-h-dvh flex-1">
      <section className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-4 pb-28 md:pt-[30px] md:pr-7 md:pb-7 md:pl-9">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] text-muted">05 · Pagos</p>
            <h1 className="mt-2 text-[32px] leading-tight font-medium tracking-[-0.025em]">Pagos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-[7px] border bg-surface p-[3px]">
              {(
                [
                  ["dia", "Día"],
                  ["semana", "Semana"],
                  ["mes", "Mes"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={period === k} onClick={() => go(k, day)} className={cn("press h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors duration-150", period === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}>
                  {l}
                </button>
              ))}
            </div>
            <button type="button" aria-label="Anterior" onClick={() => step(-1)} className="press grid size-[34px] place-items-center rounded-md border bg-surface">
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-1 font-mono text-[13px] whitespace-nowrap">{label}</span>
            <button type="button" aria-label="Siguiente" onClick={() => step(1)} disabled={period === "dia" && day >= today} className="press grid size-[34px] place-items-center rounded-md border bg-surface disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
            {day !== today && (
              <button type="button" onClick={() => go(period, todayLima())} className={smallBtn}>
                Hoy
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-7 rounded-lg border bg-surface px-4 py-3.5">
          <div>
            <p className="mb-2 text-[13px] text-muted">
              Revisados contra Yape y banco
              <span className="ml-1.5 font-mono text-fg">
                {done} de {live.length}
              </span>
            </p>
            <div className="h-1 rounded-sm bg-line">
              <div className="h-1 rounded-sm bg-fg transition-[width] duration-500 ease-(--ease-out)" style={{ width: `${live.length ? (done / live.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div>
            <p className="font-mono text-[11px] text-muted">Por revisar</p>
            <p className="mt-1 font-mono text-base text-warning">{formatMoney(toReview)}</p>
          </div>
          <div>
            <p className="font-mono text-[11px] text-muted">Neto del {period === "dia" ? "día" : period === "semana" ? "periodo" : "mes"}</p>
            <p className="mt-1 font-mono text-base">{formatMoney(net)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["todos", "Todos"],
                ...METHODS.map((m) => [m, METHOD_LABEL[m]] as const),
                ["revisar", "Por revisar"],
                ["precios", `Precios cambiados${changes.length ? ` ${changes.length}` : ""}`],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn("press h-[30px] rounded-full border px-2.5 text-[13px] transition-colors duration-150", filter === k ? "border-faint bg-line text-fg" : "border-border text-muted hover-fine:hover:text-fg")}
              >
                {l}
              </button>
            ))}
          </div>
          <a href={`/api/export?tabla=pagos&desde=${from}&hasta=${addDays(to, -1)}`} className={smallBtn}>
            <Download className="size-3.5" /> Exportar
          </a>
        </div>

        {filter === "precios" ? (
          <div className="overflow-hidden rounded-lg border bg-surface">
            {changes.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-faint">Sin cambios de precio en este periodo.</p>}
            {changes.map((c) => (
              <Link key={c.id} href={`/trabajos/${c.code}`} className="row grid grid-cols-[110px_90px_minmax(0,1fr)] gap-3 border-t border-line px-4 py-2.5 text-[13px] first:border-t-0">
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
          <div className="overflow-x-auto rounded-lg border bg-surface">
            <div className={cn("grid min-w-[620px] gap-3 px-4 py-2.5 font-mono text-[11px] text-muted", GRID)}>
              <span />
              <span>{period === "dia" ? "Hora" : "Fecha"}</span>
              <span>Cliente · trabajo</span>
              <span>Medio · operación</span>
              <span className="text-right">Monto</span>
            </div>
            {visible.length === 0 && <p className="border-t border-line px-4 py-8 text-center text-[13px] text-faint">{rows.length ? "Nada con este filtro." : "Sin pagos en este periodo."}</p>}
            {visible.map((r) => {
              const refund = r.kind === "devolucion";
              const voided = !!r.voidedAt;
              const on = !!reviewed[r.id];
              return (
                <div
                  key={r.id}
                  onClick={() => setSelId(r.id)}
                  className={cn(
                    "row grid min-w-[620px] cursor-pointer items-center gap-3 border-t border-line px-4 py-[11px]",
                    GRID,
                    selId === r.id && "bg-hover shadow-[inset_2px_0_0_var(--fg)]",
                    voided && "opacity-55",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={on ? "Quitar revisado" : "Marcar revisado"}
                    disabled={voided}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(r);
                    }}
                    className={cn("check grid size-[18px] place-items-center rounded-[4px] border transition-colors duration-150", on ? "border-success/50 bg-success/12" : "border-[#4a4a4a]")}
                  >
                    {on && <Check className="check-mark size-[13px] text-success" strokeWidth={2.4} />}
                  </button>
                  <span className="font-mono text-[13px] text-muted">{period === "dia" ? timeLima(r.paidAt) : dayMonth(r.paidAt)}</span>
                  <span className={cn("min-w-0", voided && "line-through")}>
                    <span className="block truncate text-sm">
                      {r.client}
                      {refund && <span className="ml-1.5 text-xs text-danger">Devolución</span>}
                      {r.label?.startsWith("extra") && <span className="ml-1.5 text-xs text-warning">{r.label}</span>}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {r.code} · {r.createdBy ?? "—"}
                    </span>
                    {refund && r.reason && (
                      <span className="mt-0.5 block text-xs text-muted">
                        Motivo: <span className="text-fg">{r.reason}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-[13px]">
                    <span className="block">{METHOD_LABEL[r.method]}</span>
                    <span className="font-mono text-[11px] text-muted">{r.operationNumber ?? "—"}</span>
                  </span>
                  <span className={cn("text-right font-mono", refund ? "text-danger" : "text-fg", voided && "line-through")}>
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
  const when = (iso: string) => `${dayKey(iso) === todayLima() ? "hoy" : dayMonth(iso)} ${timeLima(iso)}`;

  const save = () =>
    start(async () => {
      const res = await correctPayment({ paymentId: r.id, amount, method, paidDate: date, operationNumber: op, reason });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Pago corregido. El valor anterior quedó en el historial.");
      setMode("ver");
      router.refresh();
    });

  return (
    <aside className="sheet fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l bg-bg/96 shadow-[0_0_60px_rgba(0,0,0,0.4)] xl:sticky xl:top-0 xl:z-auto xl:h-dvh xl:shadow-none" data-state="open">
      <header className="flex items-center justify-between border-b border-line px-6 pt-[26px] pb-4">
        <div>
          <p className="font-mono text-[11px] text-muted">05 · Pagos · {mode === "ver" ? "detalle" : "corregir"}</p>
          <h2 className="mt-1.5 text-xl font-medium">{mode === "ver" ? (refund ? "Detalle de la devolución" : "Detalle del pago") : "Corregir pago"}</h2>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="press grid size-[34px] place-items-center rounded-md border bg-surface text-muted">
          <X className="size-4" />
        </button>
      </header>
      {mode === "ver" ? (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
          <div>
            <p className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">
                {refund ? "Devolución" : "Pago"} · {METHOD_LABEL[r.method]}
              </span>
              <button
                type="button"
                onClick={onToggle}
                disabled={!!r.voidedAt}
                className={cn("press inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs", reviewed ? "border-success-line text-success" : "border-warning-line text-warning")}
              >
                {reviewed ? (
                  <>
                    <Check className="size-3" strokeWidth={2.4} /> Revisado
                  </>
                ) : (
                  "Por revisar"
                )}
              </button>
            </p>
            <p className={cn("mt-2.5 mb-0.5 font-mono text-[34px] font-medium tracking-[-0.02em]", refund && "text-danger", r.voidedAt && "line-through")}>
              {refund ? "− " : ""}
              {formatMoney(r.amount)}
            </p>
            <p className="text-sm text-muted">
              <Link href={`/trabajos/${r.code}`} className="text-fg hover-fine:hover:underline">
                {r.code}
              </Link>{" "}
              · {r.client}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-line pt-4">
            <Item k="Fecha y hora" v={`${dayLabel(dayKey(r.paidAt))} ${new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "America/Lima" }).format(new Date(r.paidAt)).replace(".", "").toLowerCase()} · ${timeLima(r.paidAt)}`} />
            <Item k="N° de operación" v={r.operationNumber ?? "—"} mono />
            <Item k="Tipo" v={r.label ?? (refund ? "Devolución" : "Pago")} />
            <Item k="Registró" v={r.createdBy ?? "—"} />
            <Item k="Pendiente del trabajo" v={r.jobPending > 0 ? formatMoney(r.jobPending) : `${formatMoney(0)} · pagado`} mono tone={r.jobPending > 0 ? "text-warning" : "text-success"} />
            <Item k="Precio" v={formatMoney(r.jobTotal)} mono />
          </dl>
          {r.voidedAt && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              Anulado por {r.voidedBy} · {dayMonth(r.voidedAt)} · «{r.voidReason}»
            </p>
          )}
          <div className="flex h-[150px] items-center gap-4 rounded-lg border bg-bg p-3.5">
            <div className="flex h-[120px] w-[86px] shrink-0 flex-col justify-end gap-1 rounded-md border bg-gradient-to-b from-[#2a2a2a] to-[#202020] p-2">
              <span className="h-[5px] w-[70%] rounded-sm bg-[#4a4a4a]" />
              <span className="h-[9px] w-1/2 rounded-sm bg-faint" />
              <span className="h-[5px] w-[85%] rounded-sm bg-[#3a3a3a]" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              {r.receiptLink ? (
                <>
                  <p className="truncate text-[13px]">captura-{r.operationNumber ?? r.code}.jpg</p>
                  <p className="font-mono text-[11px] text-muted">Drive · {r.code} / Pagos</p>
                  <a href={r.receiptLink} target="_blank" rel="noreferrer" className={cn(smallBtn, "mt-1.5 self-start")}>
                    Abrir
                  </a>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-muted">Sin captura del comprobante</p>
                  <p className="font-mono text-[11px] text-faint">Drive · {r.code} / Pagos</p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="font-mono text-[11px] text-muted">Historial del pago</p>
            <div className="grid grid-cols-[8px_1fr] gap-2.5 text-[13px]">
              <span className="mt-1.5 size-[7px] rounded-full bg-faint" />
              <span>
                Registrado por <b className="font-medium">{r.createdBy ?? "—"}</b>
                <br />
                <span className="font-mono text-[11px] text-muted">{when(r.createdAt)}</span>
              </span>
              {r.history.map((h, i) => (
                <HistoryLine key={i} h={h} when={when} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <p className="text-[13px] text-muted">
            <Link href={`/trabajos/${r.code}`} className="text-fg">
              {r.code} · {r.client}
            </Link>
            . El valor anterior queda guardado en el historial.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto" aside={<span className="font-mono text-[11px] text-faint">antes {formatMoney(r.amount)}</span>} className="col-span-2">
              <Stepper label="Monto" value={amount} prefix="S/" step={1} decimals={2} onChange={setAmount} />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="N° de operación">
              <Input value={op} onChange={(e) => setOp(e.target.value)} className="font-mono" />
            </Field>
          </div>
          <Field label="Medio">
            <Choice label="Medio" value={method} onChange={setMethod} cols={2} options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} size="sm" />
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
      <footer className="flex items-center gap-2 border-t border-line px-6 py-3.5">
        {mode === "ver" ? (
          !r.voidedAt && (
            <>
              <button type="button" onClick={() => setVoiding(true)} className="press inline-flex h-8 items-center rounded-md border border-danger/40 px-3 text-[13px] font-medium text-danger">
                Anular {refund ? "devolución" : "pago"}
              </button>
              <span className="flex-1" />
              <button type="button" onClick={() => setMode("corregir")} className={smallBtn}>
                Corregir
              </button>
            </>
          )
        ) : (
          <>
            <span className="flex-1" />
            <button type="button" onClick={() => setMode("ver")} className={smallBtn}>
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={pending || reason.trim().length < 3} className="press inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-on-primary disabled:opacity-45">
              Guardar corrección
            </button>
          </>
        )}
      </footer>
      <VoidPaymentDialog payment={voiding ? { id: r.id, amount: r.amount, label: refund ? "Devolución" : "Pago" } : null} onClose={() => setVoiding(false)} />
    </aside>
  );
}

function HistoryLine({ h, when }: { h: { at: string; who: string | null; summary: string }; when: (iso: string) => string }) {
  const tone = h.summary.includes("revisado") && !h.summary.includes("quitó") ? "bg-success" : h.summary.includes("anuló") ? "bg-danger" : "bg-faint";
  return (
    <>
      <span className={cn("mt-1.5 size-[7px] rounded-full", tone)} />
      <span>
        <b className="font-medium">{h.who ?? "—"}</b> {h.summary}
        <br />
        <span className="font-mono text-[11px] text-muted">{when(h.at)}</span>
      </span>
    </>
  );
}

function Item({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] text-muted">{k}</dt>
      <dd className={cn("mt-1 truncate text-sm", mono && "font-mono", tone)}>{v}</dd>
    </div>
  );
}
