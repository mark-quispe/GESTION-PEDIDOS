"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Banknote, CalendarDays, Check, ChevronDown, CircleDollarSign, Coins, FileText, Hash, Info, Landmark, MessageSquare, Paperclip, QrCode, Search, Smartphone, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import * as D from "@radix-ui/react-dialog";
import { searchOpenJobs, type JobPick } from "@/actions/catalog";
import { getJobMoney, registerPayment, registerRefund, type JobMoney } from "@/actions/payments";
import { METHOD_LABEL, METHODS, PAY_STATE_LABEL, payState, round2 } from "@/lib/domain";
import { dayMonthNum, dueLabel, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { REFUND_REASON, type RefundInput } from "@/lib/validation/jobs";
import type { PaymentMethod } from "@/db/schema";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { DropZone } from "@/components/ui/drop-zone";


/** Registrar pago (RF-14): ventana flotante (rediseño de Mark, 27/11). Desde la ficha, el trabajo ya viene elegido. */
export function PaymentSheet({ open, onOpenChange, jobId, driveReady }: { open: boolean; onOpenChange: (v: boolean) => void; jobId: string | null; driveReady: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {open && <PaymentForm initialJobId={jobId} close={() => onOpenChange(false)} driveReady={driveReady} />}
    </D.Root>
  );
}

const METHOD_ICON: Record<PaymentMethod, ReactNode> = {
  yape: <Smartphone className="size-[18px]" strokeWidth={1.7} />,
  plin: <QrCode className="size-[18px]" strokeWidth={1.7} />,
  transferencia: <Landmark className="size-[18px]" strokeWidth={1.7} />,
  efectivo: <Banknote className="size-[18px]" strokeWidth={1.7} />,
};

function Block({ icon, title, opt, children, className }: { icon: ReactNode; title: string; opt?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-surface px-4 py-4", className)}>
      <h3 className="mb-3 flex items-center gap-3 text-[16px] font-medium">
        <span className="text-muted [&>svg]:size-5">{icon}</span>
        {title}
        {opt && <span className="font-normal text-muted">(opcional)</span>}
      </h3>
      {children}
    </section>
  );
}

function PaymentForm({ initialJobId, close, driveReady }: { initialJobId: string | null; close: () => void; driveReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState(initialJobId);
  const [loaded, setMoney] = useState<JobMoney | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!initialJobId);
  const [hits, setHits] = useState<JobPick[]>([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [day, setDay] = useState(todayLima());
  const [op, setOp] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!jobId) return;
    getJobMoney(jobId).then((m) => {
      setMoney(m);
      if (m) setAmount(m.pending);
    });
  }, [jobId]);

  const money = jobId && loaded?.id === jobId ? loaded : null;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => setHits(await searchOpenJobs(q)), 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const save = () =>
    start(async () => {
      if (!jobId) return void toast.error("Elige el trabajo");
      const r = await registerPayment({ jobId, amount, method, paidDate: day, operationNumber: op || undefined, note: note || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Pago de ${formatMoney(amount)} registrado.`);
      close();
      router.refresh();
    });

  const after = money ? round2(money.paid + amount) : 0;
  const afterState = money ? payState(money.total, after) : null;

  return (
    <D.Portal>
      <D.Overlay className="overlay fixed inset-0 z-50 bg-scrim backdrop-blur-[3px]" />
      <D.Content
        aria-describedby={undefined}
        className="modal fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[1060px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-side shadow-[0_30px_80px_rgba(0,0,0,0.5)] focus:outline-none [&_*]:leading-[normal]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex items-center gap-4">
            <span className="grid size-[60px] shrink-0 place-items-center rounded-xl border bg-surface">
              <Coins className="size-7 text-fg-2" strokeWidth={1.6} />
            </span>
            <div>
              <D.Title className="text-[24px] font-semibold tracking-[-0.02em]">Registrar pago</D.Title>
              <p className="mt-1 text-[15px] text-muted">Registra un abono o pago total de un trabajo.</p>
            </div>
          </div>
          <D.Close aria-label="Cerrar" className="press grid size-11 place-items-center rounded-lg border bg-surface text-muted hover-fine:hover:text-fg">
            <X className="size-5" />
          </D.Close>
        </header>

        <div className="scroll-thin grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 pb-5 md:grid-cols-[minmax(0,1fr)_310px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Block icon={<FileText strokeWidth={1.6} />} title="Trabajo">
              <div className="relative">
                <label className="flex h-11 items-center gap-3 rounded-lg border bg-bg/60 px-3.5 focus-within:border-muted">
                  <Search className="size-[18px] text-muted" />
                  <input
                    autoFocus={!initialJobId}
                    value={open ? q : money ? `${money.code} · ${money.title}` : q}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setOpen(true);
                    }}
                    placeholder="Buscar por código, nombre o cliente…"
                    aria-label="Buscar trabajo"
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
                  />
                  <button type="button" aria-label="Abrir la lista" onClick={() => setOpen((v) => !v)} className="text-muted">
                    <ChevronDown className={cn("size-5 transition-transform duration-200", open && "rotate-180")} />
                  </button>
                </label>
                {open && (
                  <div className="pop-in absolute top-[calc(100%+6px)] right-0 left-0 z-10 max-h-64 origin-top overflow-y-auto rounded-lg border bg-surface shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setJobId(h.id);
                          setOpen(false);
                          setQ("");
                        }}
                        className={cn("row flex w-full items-center gap-3 px-3.5 py-2.5 text-left", h.id === jobId && "bg-hover")}
                      >
                        <span className="w-[72px] shrink-0 font-mono text-[12.5px] text-muted">{h.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{h.title}</span>
                          <span className="block truncate text-xs text-muted">{h.clientName}</span>
                        </span>
                        <span className="text-xs text-muted tabular-nums">{formatMoney(h.price)}</span>
                      </button>
                    ))}
                    {hits.length === 0 && <p className="px-3.5 py-3 text-[13px] text-faint">Escribe el código, el trabajo o el cliente.</p>}
                  </div>
                )}
              </div>
            </Block>

            <Block icon={<CircleDollarSign strokeWidth={1.6} />} title="Monto y medio de pago">
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div>
                  <p className="mb-2 text-[14px] text-muted">Monto a registrar</p>
                  <Stepper label="Monto a registrar" value={amount} step={10} prefix="S/" decimals={2} onChange={setAmount} className="h-11 bg-bg/60" />
                  {money && money.pending > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setAmount(money.pending)} className="press rounded-md border px-2 py-1 text-xs text-muted hover-fine:hover:text-fg">
                        Todo · {formatMoney(money.pending)}
                      </button>
                      <button type="button" onClick={() => setAmount(round2(money.pending / 2))} className="press rounded-md border px-2 py-1 text-xs text-muted hover-fine:hover:text-fg">
                        Mitad
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-[14px] text-muted">Medio de pago</p>
                  <div role="radiogroup" aria-label="Medio de pago" className="flex flex-wrap gap-1.5">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={method === m}
                        onClick={() => setMethod(m)}
                        className={cn(
                          "press inline-flex h-11 items-center gap-2 rounded-lg border px-3 text-[14px] transition-colors",
                          method === m ? "border-fg bg-line text-fg" : "bg-bg/60 text-fg-2 hover-fine:hover:border-border-strong",
                        )}
                      >
                        {METHOD_ICON[m]}
                        {METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2.5 text-[15px] font-medium">
                    <CalendarDays className="size-5 text-muted" strokeWidth={1.6} /> Fecha de pago
                  </span>
                  <input type="date" value={day} max={todayLima()} onChange={(e) => setDay(e.target.value)} className="h-11 w-full rounded-lg border bg-bg/60 px-3.5 text-[15px] outline-none focus:border-muted dark:[color-scheme:dark]" />
                </label>
                <label className="block">
                  <span className="mb-2 flex items-center gap-2.5 text-[15px] font-medium">
                    <Hash className="size-5 text-muted" strokeWidth={1.6} /> N.º de operación <span className="font-normal text-muted">(opcional)</span>
                  </span>
                  <input value={op} onChange={(e) => setOp(e.target.value)} placeholder="Ej. 123456" className="h-11 w-full rounded-lg border bg-bg/60 px-3.5 font-mono text-[15px] outline-none placeholder:text-faint focus:border-muted" />
                </label>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 flex items-center gap-2.5 text-[15px] font-medium">
                  <Paperclip className="size-5 text-muted" strokeWidth={1.6} /> Comprobante <span className="font-normal text-muted">(opcional)</span>
                </p>
                <DropZone
                  file={file}
                  onFile={setFile}
                  title="Arrastra o selecciona una imagen"
                  accept="image/*,application/pdf"
                  where={money ? `Drive › ${money.code} › Pagos` : "Drive › Pagos"}
                  disabledHint={driveReady ? null : "Drive sin conectar: la captura se podrá subir cuando el admin lo conecte."}
                />
              </div>
              <label className="mt-4 block border-t border-line pt-4">
                <span className="mb-2 flex items-center gap-2.5 text-[15px] font-medium">
                  <MessageSquare className="size-5 text-muted" strokeWidth={1.6} /> Observaciones <span className="font-normal text-muted">(opcional)</span>
                </span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder="Ej. Pago del adelanto." className="w-full resize-y rounded-lg border bg-bg/60 px-3.5 py-2.5 text-[15px] outline-none placeholder:text-faint focus:border-muted" />
              </label>
            </Block>
          </div>

          <aside className="flex flex-col gap-4">
            <Block icon={<FileText strokeWidth={1.6} />} title="Trabajo seleccionado">
              {money ? (
                <div>
                  <p className="font-mono text-[13px] text-muted">{money.code}</p>
                  <p className="mt-1 text-[17px] font-semibold">{money.title}</p>
                  <p className="mt-2 flex items-center gap-2 text-[14px] text-muted">
                    <UserRound className="size-4" /> {money.clientName}
                  </p>
                  <p className="mt-1 text-[13px] text-faint">Entrega {dueLabel(money.dueAt).toLowerCase()}</p>
                </div>
              ) : (
                <p className="text-[14px] text-faint">Elige un trabajo para ver lo que debe.</p>
              )}
            </Block>
            {money && (
              <section className="overflow-hidden rounded-xl border bg-surface">
                <h3 className="flex items-center gap-3 px-4 pt-4 pb-2 text-[16px] font-medium">
                  <Coins className="size-5 text-muted" strokeWidth={1.6} /> Estado de pago
                </h3>
                <div className="flex justify-between px-4 py-2 text-[15px]">
                  <span className="text-fg-2">Total del trabajo</span>
                  <span className="font-semibold tabular-nums">{formatMoney(money.total)}</span>
                </div>
                <div className="flex justify-between px-4 py-2 text-[15px] text-success">
                  <span>Pagado</span>
                  <span className="font-semibold tabular-nums">{formatMoney(money.paid)}</span>
                </div>
                <div className={cn("flex justify-between px-4 py-2.5 text-[15px]", money.pending > 0 ? "bg-warning-soft text-warning" : "text-success")}>
                  <span>Pendiente</span>
                  <span className="font-semibold tabular-nums">{formatMoney(money.pending)}</span>
                </div>
                {money.payments.length > 0 && (
                  <div className="border-t border-line px-4 py-2.5">
                    <p className="mb-1 text-xs text-muted">Pagos anteriores</p>
                    {money.payments.map((p) => (
                      <p key={p.id} className={cn("flex justify-between py-0.5 text-[12.5px]", p.voided && "text-faint line-through")}>
                        <span className="text-muted">
                          {dayMonthNum(p.paidAt)} · {METHOD_LABEL[p.method as PaymentMethod]}
                          {p.kind === "devolucion" && " · devolución"}
                        </span>
                        <span className="tabular-nums">
                          {p.kind === "devolucion" ? "− " : ""}
                          {formatMoney(p.amount)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </section>
            )}
            <p className="flex gap-3 rounded-xl border bg-surface px-4 py-3.5 text-[13.5px] text-fg-2">
              <Info className="mt-0.5 size-[18px] shrink-0 text-muted" />
              {money && afterState ? (
                <span>
                  El pago se registrará y lo pendiente quedará en <b className="font-semibold">{formatMoney(Math.max(0, money.total - after))}</b> ·{" "}
                  <span className={afterState === "pagado" ? "text-success" : afterState === "de_mas" ? "text-warning" : ""}>{PAY_STATE_LABEL[afterState]}</span>.
                </span>
              ) : (
                <span>El pago se registrará y se actualizará el saldo pendiente del trabajo.</span>
              )}
            </p>
          </aside>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <p className="hidden text-[13px] text-faint sm:block">Queda confirmado al guardar. El admin lo revisa en Pagos.</p>
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={close} className="press h-11 rounded-lg border bg-surface px-5 text-[15px] font-medium">
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={pending || !jobId || amount <= 0} className="press inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-medium text-on-primary disabled:opacity-45">
              <Check className="size-5" strokeWidth={2.2} />
              {pending ? "Guardando…" : "Registrar pago"}
            </button>
          </div>
        </footer>
      </D.Content>
    </D.Portal>
  );
}

/* ---------- Devolución (RF-42) ---------- */

export type RefundPreset = { jobId: string; amount?: number; reason?: RefundInput["reasonKind"]; cancel?: boolean };

export function RefundDialog({ preset, onClose, driveReady }: { preset: RefundPreset | null; onClose: () => void; driveReady: boolean }) {
  return <DialogRoot open={!!preset} onOpenChange={(v) => !v && onClose()}>{preset && <RefundForm preset={preset} close={onClose} driveReady={driveReady} />}</DialogRoot>;
}

function RefundForm({ preset, close, driveReady }: { preset: RefundPreset; close: () => void; driveReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState<JobMoney | null>(null);
  const [amount, setAmount] = useState(preset.amount ?? 0);
  const [reason, setReason] = useState<RefundInput["reasonKind"] | null>(preset.reason ?? null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [day, setDay] = useState(todayLima());
  const [op, setOp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cancel, setCancel] = useState(preset.cancel ?? false);

  useEffect(() => {
    getJobMoney(preset.jobId).then(setM);
  }, [preset.jobId]);

  const save = () =>
    start(async () => {
      if (!reason) return void toast.error("Elige el motivo");
      const r = await registerRefund({ jobId: preset.jobId, amount, method, paidDate: day, operationNumber: op || undefined, reasonKind: reason, reasonNote: note || undefined, cancelJob: cancel });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Devolución de ${formatMoney(amount)} registrada.`);
      close();
      router.refresh();
    });

  const after = m ? round2(m.paid - amount) : 0;
  return (
    <DialogContent
      wide
      eyebrow={`02 · Trabajos${m ? ` · ${m.code}` : ""}`}
      title="Registrar devolución"
      description="Se resta de lo pagado y queda en Pagos y en el Historial."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs leading-snug text-faint">
            Después de guardar
            <br />
            <span className="text-fg-2">
              Pagado {formatMoney(Math.max(0, after))}
              {cancel && <span className="text-danger"> · Cancelado</span>}
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="md" onClick={close}>
              Cancelar
            </Button>
            <Button size="md" variant="danger" onClick={save} disabled={pending || amount <= 0}>
              {pending ? "Guardando…" : "Registrar devolución"}
            </Button>
          </div>
        </div>
      }
    >
      {m && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border bg-bg px-3.5 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-muted">{m.code}</p>
              <p className="truncate text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted">
                {m.clientName} · {m.itemsDone} de {m.itemsTotal} ítems hechos
              </p>
            </div>
            <dl className="flex gap-5 text-right text-[13px]">
              <div>
                <dt className="font-mono text-[10.5px] text-muted">Precio</dt>
                <dd className="font-mono">{formatMoney(m.total)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] text-muted">Pagado</dt>
                <dd className="font-mono">{formatMoney(m.paid)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] text-muted">Pendiente</dt>
                <dd className="font-mono text-warning">{formatMoney(m.pending)}</dd>
              </div>
            </dl>
          </div>
          <Field label="Monto a devolver" aside={<span className="font-mono text-[11px] text-faint">se escribe libre</span>}>
            <div className="flex flex-wrap gap-1.5">
              <Stepper label="Monto a devolver" value={amount} prefix="− S/" step={10} decimals={2} max={m.paid} onChange={setAmount} className="w-44 text-danger" />
              <Button size="md" onClick={() => setAmount(m.paid)}>
                Todo lo pagado · {formatMoney(m.paid)}
              </Button>
              {m.advance && (
                <Button size="md" onClick={() => setAmount(m.advance!)}>
                  Lo del adelanto · {formatMoney(m.advance)}
                </Button>
              )}
            </div>
          </Field>
          <Field
            label={
              <>
                Motivo <span className="text-danger">*</span>
              </>
            }
            aside={<span className="font-mono text-[11px] text-faint">obligatorio</span>}
          >
            <Choice
              label="Motivo"
              value={reason}
              onChange={(v) => {
                setReason(v);
                setCancel(v === "cancelo");
              }}
              options={(Object.keys(REFUND_REASON) as RefundInput["reasonKind"][]).map((k) => ({ value: k, label: REFUND_REASON[k] }))}
              size="sm"
            />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota: qué pasó y cuánto se queda el estudio por lo avanzado" className="mt-1.5 min-h-14" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
            <Field label="Medio">
              <Choice label="Medio" value={method} onChange={setMethod} options={METHODS.map((x) => ({ value: x, label: METHOD_LABEL[x] }))} size="sm" />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={day} max={todayLima()} onChange={(e) => setDay(e.target.value)} className="h-8" />
            </Field>
            <Field label="N.º de operación" optional>
              <Input value={op} onChange={(e) => setOp(e.target.value)} className="h-8 font-mono" />
            </Field>
          </div>
          <DropZone
            file={file}
            onFile={setFile}
            title="Captura de la devolución · opcional"
            where={`Drive › ${m.code} › Pagos`}
            disabledHint={driveReady ? null : "Drive sin conectar: la captura se podrá subir cuando el admin lo conecte."}
          />
          {m.status !== "cancelado" && (
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors duration-150", cancel ? "border-danger-line bg-danger-soft" : "")}>
              <input type="checkbox" checked={cancel} onChange={(e) => setCancel(e.target.checked)} className="mt-0.5 size-4 accent-[var(--danger)]" />
              <span className="text-[13px]">
                Pasar el trabajo a <span className="text-danger">Cancelado</span> al guardar
                <span className="block text-xs text-muted">Sale de Por tomar y de la Agenda. Lo hecho ({m.itemsDone} ítems) queda a nombre de quien lo hizo.</span>
              </span>
            </label>
          )}
        </div>
      )}
    </DialogContent>
  );
}
