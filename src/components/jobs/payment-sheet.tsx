"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import * as D from "@radix-ui/react-dialog";
import { searchOpenJobs, type JobPick } from "@/actions/catalog";
import { getJobMoney, registerPayment, registerRefund, type JobMoney } from "@/actions/payments";
import { METHOD_LABEL, METHODS, PAY_STATE_LABEL, payState, round2 } from "@/lib/domain";
import { dayMonthNum, dueLabel, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { REFUND_REASON, type RefundInput } from "@/lib/validation/jobs";
import type { PaymentMethod } from "@/db/schema";
import { DialogContent, DialogRoot, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { DropZone } from "@/components/ui/drop-zone";

const toneDot = { sin_pagar: "bg-danger", adelanto: "bg-warning", pagado: "bg-success", de_mas: "bg-warning" } as const;

function MoneyBox({ m, after }: { m: JobMoney; after?: number }) {
  const st = payState(m.total, m.paid);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-bg px-3.5 py-3">
        <p className="font-mono text-[11px] text-muted">{m.code}</p>
        <p className="mt-0.5 text-sm font-medium">{m.title}</p>
        <p className="text-xs text-muted">
          {m.clientName}
          {m.clientUniversity ? ` · ${m.clientUniversity}` : ""} · entrega {dueLabel(m.dueAt).toLowerCase()}
        </p>
        <span className="mt-2 inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs">
          <span className={cn("size-1.5 rounded-full", toneDot[st])} />
          {PAY_STATE_LABEL[st]}
        </span>
      </div>
      <dl className="grid grid-cols-3 overflow-hidden rounded-lg border text-[13px]">
        {[
          ["Precio", formatMoney(m.total), ""],
          ["Pagado", formatMoney(m.paid), ""],
          ["Pendiente", formatMoney(m.pending), m.pending > 0 ? "text-warning" : ""],
        ].map(([k, v, c], i) => (
          <div key={k} className={cn("px-3 py-2", i > 0 && "border-l")}>
            <dt className="font-mono text-[10.5px] text-muted">{k}</dt>
            <dd className={cn("mt-0.5 font-mono", c)}>{v}</dd>
          </div>
        ))}
      </dl>
      {m.payments.length > 0 && (
        <div className="rounded-lg border px-3 py-2">
          <p className="mb-1 font-mono text-[10.5px] text-muted">Pagos anteriores</p>
          {m.payments.map((p) => (
            <p key={p.id} className={cn("flex justify-between py-0.5 text-[12.5px]", p.voided && "text-faint line-through")}>
              <span className="text-muted">
                {dayMonthNum(p.paidAt)} · {METHOD_LABEL[p.method as PaymentMethod]}
                {p.kind === "devolucion" && " · devolución"}
              </span>
              <span className="font-mono">
                {p.kind === "devolucion" ? "− " : ""}
                {formatMoney(p.amount)}
              </span>
            </p>
          ))}
        </div>
      )}
      {after !== undefined && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-[12.5px] text-muted">
          Después de guardar
          <span className="block text-fg">
            Pendiente {formatMoney(Math.max(0, m.total - after))} ·{" "}
            <span className={payState(m.total, after) === "pagado" ? "text-success" : payState(m.total, after) === "de_mas" ? "text-warning" : ""}>
              {PAY_STATE_LABEL[payState(m.total, after)]}
            </span>
          </span>
        </p>
      )}
    </div>
  );
}

/** Registrar pago (RF-14): panel a la derecha. Desde la ficha, el trabajo ya viene elegido. */
export function PaymentSheet({ open, onOpenChange, jobId, driveReady }: { open: boolean; onOpenChange: (v: boolean) => void; jobId: string | null; driveReady: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {open && <PaymentForm initialJobId={jobId} close={() => onOpenChange(false)} driveReady={driveReady} />}
    </D.Root>
  );
}

function PaymentForm({ initialJobId, close, driveReady }: { initialJobId: string | null; close: () => void; driveReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState(initialJobId);
  const [loaded, setMoney] = useState<JobMoney | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<JobPick[]>([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [day, setDay] = useState(todayLima());
  const [op, setOp] = useState("");
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
    if (jobId) return;
    const t = setTimeout(async () => setHits(await searchOpenJobs(q)), 150);
    return () => clearTimeout(t);
  }, [q, jobId]);

  const save = () =>
    start(async () => {
      if (!jobId) return void toast.error("Elige el trabajo");
      const r = await registerPayment({ jobId, amount, method, paidDate: day, operationNumber: op || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Pago de ${formatMoney(amount)} registrado.`);
      close();
      router.refresh();
    });

  return (
    <SheetContent
      eyebrow={`02 · Trabajos${money ? ` · ${money.code}` : ""}`}
      title="Registrar pago"
      className="max-w-[760px]"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs text-faint">{initialJobId ? "Desde la ficha, el trabajo ya viene elegido." : "Queda confirmado al guardar."}</p>
          <div className="flex gap-2">
            <Button size="md" onClick={close}>
              Cancelar
            </Button>
            <Button size="md" variant="primary" onClick={save} disabled={pending || !jobId || amount <= 0}>
              {pending ? "Guardando…" : "Registrar pago"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <Field label="Monto">
            <Stepper label="Monto" value={amount} step={10} prefix="S/" decimals={2} onChange={setAmount} />
          </Field>
          {money && money.pending > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => setAmount(money.pending)}>
                Todo lo pendiente · {formatMoney(money.pending)}
              </Button>
              <Button size="sm" onClick={() => setAmount(round2(money.pending / 2))}>
                Mitad · {formatMoney(round2(money.pending / 2))}
              </Button>
            </div>
          )}
          <Field label="Medio">
            <Choice label="Medio de pago" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <Input type="date" value={day} max={todayLima()} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label="N.º de operación" optional>
              <Input value={op} onChange={(e) => setOp(e.target.value)} className="font-mono" />
            </Field>
          </div>
          <Field label="Captura del comprobante" optional>
            <DropZone
              file={file}
              onFile={setFile}
              where={money ? `Drive › ${money.code} › Pagos` : "Drive › Pagos"}
              disabledHint={driveReady ? null : "Drive sin conectar: la captura se podrá subir cuando el admin lo conecte."}
            />
          </Field>
          <p className="text-xs text-faint">Queda confirmado al guardar. El admin lo revisa en Pagos del día.</p>
        </div>
        <aside className="flex flex-col gap-3">
          {!initialJobId && (
            <Field label="Trabajo" aside={<span className="font-mono text-[11px] text-faint">código o cliente</span>}>
              {jobId && money ? (
                <button type="button" onClick={() => setJobId(null)} className="press flex h-10 items-center justify-between rounded-md border bg-surface px-3 text-left font-mono text-sm">
                  {money.code}
                  <span className="font-sans text-xs text-info">Cambiar</span>
                </button>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="flex h-10 items-center gap-2 rounded-md border bg-surface px-3 focus-within:border-muted">
                    <Search className="size-4 text-muted" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="PC26-014 o Lucía" aria-label="Buscar trabajo" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  </label>
                  <div className="overflow-hidden rounded-md border">
                    {hits.map((h) => (
                      <button key={h.id} type="button" onClick={() => setJobId(h.id)} className="row flex w-full flex-col px-3 py-2 text-left">
                        <span className="font-mono text-[11px] text-muted">{h.code}</span>
                        <span className="truncate text-[13px]">
                          {h.clientName} · {h.title}
                        </span>
                      </button>
                    ))}
                    {hits.length === 0 && <p className="px-3 py-3 text-xs text-faint">Escribe el código o el nombre.</p>}
                  </div>
                </div>
              )}
            </Field>
          )}
          {money && <MoneyBox m={money} after={round2(money.paid + amount)} />}
        </aside>
      </div>
    </SheetContent>
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
