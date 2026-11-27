"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarClock, Info, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cancelJob, editJob, releaseJob, requestCorrection } from "@/actions/jobs";
import { voidPayment } from "@/actions/payments";
import { getNewJobData, type NewJobData } from "@/actions/catalog";
import type { PaymentMethod, Urgency, UrgencyConfig } from "@/db/schema";
import { formatDeadline, METHOD_LABEL, METHODS, paidNet, round2, URGENCIES, URGENCY_LABEL } from "@/lib/domain";
import { addDays, dayKey, dayMonthNum, timeLima, todayLima, weekdayShort } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { CANCEL_REASON, type CancelInput } from "@/lib/validation/jobs";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { DropZone } from "@/components/ui/drop-zone";
import { HoldButton } from "@/components/ui/hold-button";
import { LinesEditor, lineTotal, type Line } from "@/components/jobs/lines-editor";
import { useJobDialogs } from "@/components/jobs/job-dialogs";
import type { JobJSON, Me } from "@/components/jobs/types";

function useMoney(job: JobJSON) {
  return useMemo(() => {
    const extras = round2(job.extras.reduce((a, e) => a + e.amount, 0));
    const total = round2(job.price + extras);
    const paid = paidNet(job.payments);
    return { extras, total, paid, pending: round2(Math.max(0, total - paid)) };
  }, [job]);
}

function JobHead({ job, note }: { job: JobJSON; note?: string }) {
  const m = useMoney(job);
  const done = job.items.filter((i) => i.doneAt).length;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border bg-bg px-3.5 py-3">
      <div className="min-w-0">
        <p className="font-mono text-[11px] text-muted">{job.code}</p>
        <p className="truncate text-sm font-medium">{job.title}</p>
        <p className="text-xs text-muted">
          {job.client.name}
          {note ? ` · ${note}` : ""} · {done} de {job.items.length} ítems hechos
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
          <dd className={cn("font-mono", m.pending > 0 && "text-warning")}>{formatMoney(m.pending)}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------- Soltar (RF-61) ---------- */

export function ReleaseDialog({ job, open, onOpenChange, me }: { job: JobJSON; open: boolean; onOpenChange: (v: boolean) => void; me: Me }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const doneItems = job.items.filter((i) => i.doneAt);
  const left = job.items.filter((i) => !i.doneAt);
  const h = (xs: typeof job.items) => round2(xs.reduce((a, i) => a + i.hours, 0));
  // El admin saca a otra persona (o al externo); quien lo tiene lo suelta.
  const other = job.responsibleId !== me.id;
  const name = job.externo?.name ?? job.responsible?.name ?? "";
  const save = () =>
    start(async () => {
      const r = await releaseJob({ jobId: job.id, note: note || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(other ? `${name.split(" ")[0]} ya no está en este trabajo. Volvió a Por tomar.` : left.length ? "Soltado. Lo que falta volvió a Por tomar." : "Soltado.");
      onOpenChange(false);
      router.refresh();
    });
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          eyebrow={`${job.code} · ${other ? "sacar" : "soltar"}`}
          title={other ? `Sacar a ${name} del trabajo` : left.length && doneItems.length ? `Soltar con ${left.length} ${left.length === 1 ? "ítem pendiente" : "ítems pendientes"}` : "Soltar el trabajo"}
          description={
            other
              ? `El trabajo vuelve a Por tomar${left.length ? ", con lo que falta a la vista" : ""}. Lo que ${name.split(" ")[0]} ya hizo queda a su nombre. Queda en el Historial.`
              : `El trabajo vuelve a quedar sin tomar${left.length ? ", con lo que falta a la vista" : ""}. Lo que hiciste queda a tu nombre.`
          }
          footer={
            <>
              <Button size="md" onClick={() => onOpenChange(false)}>
                {other ? "Volver" : "Seguir con él"}
              </Button>
              <Button size="md" variant={other ? "danger" : "primary"} onClick={save} disabled={pending}>
                <Undo2 /> {other ? `Sacar a ${name.split(" ")[0]}` : "Soltar"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {doneItems.length > 0 && (
              <ItemGroup title={`Queda a ${me.name.split(" ")[0] === job.responsible?.name?.split(" ")[0] ? "tu nombre" : "nombre de quien lo hizo"}`} meta={`${h(doneItems)} h aprox. · ${doneItems.length} ${doneItems.length === 1 ? "ítem" : "ítems"}`} items={doneItems} done />
            )}
            {left.length > 0 && <ItemGroup title="Falta · vuelve a Por tomar" tone="warning" meta={`${h(left)} h aprox. · ${left.length} ${left.length === 1 ? "ítem" : "ítems"}`} items={left} />}
            <Field label={other ? "Motivo y nota para quien lo tome" : "Nota para quien lo tome"} optional>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={other ? "Por qué lo sacas, dónde están los archivos, qué falta…" : "Dónde dejaste los archivos, qué falta revisar…"} />
            </Field>
          </div>
        </DialogContent>
      )}
    </DialogRoot>
  );
}

function ItemGroup({ title, meta, items, done, tone }: { title: string; meta: string; items: JobJSON["items"]; done?: boolean; tone?: "warning" }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <p className={cn("flex justify-between border-b px-3 py-2 text-[13px] font-medium", tone === "warning" && "text-warning")}>
        {title}
        <span className="font-mono text-[11px] font-normal text-muted">{meta}</span>
      </p>
      {items.map((i) => (
        <p key={i.id} className="flex items-center gap-3 border-t border-line px-3 py-2 text-[13px] first-of-type:border-t-0">
          <span className="w-12 font-mono text-[11px] text-muted">{i.code}</span>
          <span className={cn("min-w-0 flex-1 truncate", done && "text-muted line-through")}>{i.name}</span>
          <span className="font-mono text-[11px] text-faint">{i.hours} h aprox.</span>
        </p>
      ))}
    </div>
  );
}

/* ---------- Correcciones (RF-65) ---------- */

export function CorrectionDialog({
  job,
  open,
  onOpenChange,
  me,
  externos,
  driveReady,
}: {
  job: JobJSON;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  me: Me;
  externos: { id: string; name: string }[];
  driveReady: boolean;
}) {
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <CorrectionForm job={job} close={() => onOpenChange(false)} me={me} externos={externos} driveReady={driveReady} />}</DialogRoot>;
}

function CorrectionForm({ job, close, me, externos, driveReady }: { job: JobJSON; close: () => void; me: Me; externos: { id: string; name: string }[]; driveReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const round = job.correctionRounds + 1;
  const outside = round > 2;
  const today = todayLima();
  const oldDay = dayKey(job.dueAt);
  const base = oldDay < today ? today : oldDay;
  const [request, setRequest] = useState("");
  const [shift, setShift] = useState<"0" | "1" | "2" | "3" | "otra">("1");
  const [otherDay, setOtherDay] = useState(addDays(base, 1));
  const [charge, setCharge] = useState<"incluida" | "se_cobra" | "error_estudio" | "extra">(outside ? "error_estudio" : "incluida");
  const [whatFailed, setWhatFailed] = useState("");
  const [amount, setAmount] = useState(0);
  const [paidNow, setPaidNow] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [op, setOp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const mineNow = job.responsibleId === me.id;
  const [who, setWho] = useState<"pozo" | "yo" | "externo">(mineNow ? "yo" : "pozo");
  const [externoId, setExternoId] = useState("");
  const newDay = shift === "otra" ? otherDay : addDays(base, Number(shift));
  const newTime = timeLima(job.dueAt);
  const charged = charge === "se_cobra" || charge === "extra";

  const save = () =>
    start(async () => {
      const r = await requestCorrection({
        jobId: job.id,
        request,
        newDueDate: newDay,
        newDueTime: newTime,
        charge,
        whatFailed: whatFailed || undefined,
        amount: charged ? amount : undefined,
        paidNow: charged && paidNow,
        method: charged && paidNow ? method : undefined,
        operationNumber: op || undefined,
        who,
        externoId: who === "externo" ? externoId || undefined : undefined,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Corrección ${job.corrections.length + 1} registrada.`);
      close();
      router.refresh();
    });

  const dayName = (d: string) => `${weekdayShort(new Date(`${d}T12:00:00-05:00`))} ${dayMonthNum(new Date(`${d}T12:00:00-05:00`))}`;

  return (
    <DialogContent
      wide
      title={job.status === "en_revision" ? "Pidió correcciones" : `Corrección ${Math.min(round, 2)}/2`}
      description={`${job.code} · ${job.title}`}
      eyebrow={
        outside ? (
          <span className="text-warning">Ronda {round} · fuera de las 2</span>
        ) : (
          <span>
            Ronda {round} de 2 incluidas
          </span>
        )
      }
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancelar
          </Button>
          <Button size="md" variant="primary" onClick={save} disabled={pending}>
            {who === "yo" && !mineNow ? "Tomar y empezar corrección" : "Enviar a corrección"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="¿Qué pidió corregir?">
          <Textarea autoFocus value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Que la escalera vaya en L y cambiar el rotulado al formato del profesor." />
        </Field>
        <Field label="Nueva fecha de entrega">
          <div className="flex items-center gap-2 text-[13px]">
            <CalendarClock className="size-4 text-muted" />
            <span className="font-medium">{dayName(newDay)}</span>
            <span className="text-faint">
              antes <span className="line-through">{dayName(oldDay)}</span>
            </span>
          </div>
          <Choice
            label="Nueva fecha"
            value={shift}
            onChange={setShift}
            options={[
              { value: "0", label: "Misma fecha" },
              { value: "1", label: "+1 día" },
              { value: "2", label: "+2 días" },
              { value: "3", label: "+3 días" },
              { value: "otra", label: "Otra…" },
            ]}
            size="sm"
          />
          {shift === "otra" && <Input type="date" value={otherDay} min={today} onChange={(e) => setOtherDay(e.target.value)} className="mt-1 w-48" />}
        </Field>
        <Field label={outside ? "¿Por qué otra corrección?" : "¿Se cobra?"}>
          <Choice
            label="¿Se cobra?"
            value={charge}
            onChange={setCharge}
            options={
              outside
                ? [
                    { value: "error_estudio", label: "Error del estudio · no se cobra" },
                    { value: "extra", label: "Pedido extra del cliente · se cobra" },
                  ]
                : [
                    { value: "incluida", label: `Incluida · ronda ${round} de 2` },
                    { value: "se_cobra", label: "Se cobra aparte" },
                  ]
            }
          />
        </Field>
        {charge === "error_estudio" && (
          <Field label="¿Qué falló?" hint={<>No se cobra y <b>no descuenta</b> de las correcciones del cliente. Queda en el Historial y en Estadísticas como error del estudio.</>}>
            <Textarea value={whatFailed} onChange={(e) => setWhatFailed(e.target.value)} placeholder="El rotulado quedó con el formato anterior aunque el cliente ya lo había pedido." className="min-h-14" />
          </Field>
        )}
        {charged && (
          <div className="enter flex flex-col gap-3 rounded-lg border bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <Stepper label="Monto" value={amount} prefix="S/" decimals={2} onChange={setAmount} className="w-40" />
              <p className="min-w-0 flex-1 text-xs text-muted">
                {charge === "extra" && <b className="font-medium text-warning">Consulta el monto al admin </b>}
                Escribe el monto o usa las flechas (de S/ 1 en 1). Va a <b className="font-medium text-fg-2">Extras</b>, aparte del precio pactado.
              </p>
            </div>
            <Field label="¿Pagó ahora?">
              <Choice
                label="¿Pagó ahora?"
                value={paidNow ? "si" : "no"}
                onChange={(v) => setPaidNow(v === "si")}
                options={[
                  { value: "si", label: "Pagó ahora" },
                  { value: "no", label: "Lo paga después" },
                ]}
                size="sm"
              />
            </Field>
            {paidNow ? (
              <>
                <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                  <Choice label="Medio" value={method} onChange={setMethod} options={METHODS.map((x) => ({ value: x, label: x === "transferencia" ? "Transf." : METHOD_LABEL[x] }))} size="sm" />
                  <Input value={op} onChange={(e) => setOp(e.target.value)} placeholder="N.º operación" className="h-8 font-mono" />
                </div>
                <DropZone file={file} onFile={setFile} where={`Drive › ${job.code} › Pagos`} disabledHint={driveReady ? null : "Drive sin conectar: la captura se podrá subir cuando el admin lo conecte."} />
                <p className="text-xs text-faint">
                  Queda en <b className="font-medium text-fg-2">Pagos</b> como «Pago corrección {job.corrections.length + 1}» · lo pendiente no cambia
                </p>
              </>
            ) : (
              <p className="text-xs text-faint">Sube lo pendiente en {formatMoney(amount)}.</p>
            )}
          </div>
        )}
        <Field label="¿Quién hace la corrección?">
          <Choice
            label="¿Quién hace la corrección?"
            value={who}
            onChange={setWho}
            options={[
              { value: "pozo", label: "Por tomar" },
              { value: "yo", label: "Yo la tomo" },
              { value: "externo", label: "Externo…", disabled: externos.length === 0 },
            ]}
          />
          <p className="text-xs text-muted">
            {who === "pozo" ? "Le sale a todo Producción y la toma quien pueda." : who === "yo" ? "La corrección pasa a tu nombre y el trabajo vuelve a En proceso contigo." : "Se le encarga al externo; tú sigues el avance."}
          </p>
          {who === "externo" && (
            <select value={externoId} onChange={(e) => setExternoId(e.target.value)} aria-label="Externo" className="h-10 rounded-md border bg-surface px-3 text-sm">
              <option value="">Elige al externo…</option>
              {externos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="flex items-center gap-2 text-[13px] text-muted">
          Lo recibió <span className="text-fg">{me.name}</span> · hoy {timeLima(new Date())} <span className="text-faint">(quien registra)</span>
        </p>
        <p className="flex items-start gap-2 rounded-md border border-dashed border-border-strong px-3 py-2.5 text-[12.5px] text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Vuelve a <b className="font-medium text-fg-2">Correcciones</b> y el atraso se cuenta desde la <b className="font-medium text-fg-2">nueva fecha</b>. El tiempo que estuvo en revisión por el cliente no cuenta como atraso. El cambio queda en el Historial.
          </span>
        </p>
      </div>
    </DialogContent>
  );
}

/* ---------- Editar (RF-16) ---------- */

export function EditDialog({
  job,
  open,
  onOpenChange,
  urgency,
  externos,
}: {
  job: JobJSON;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  urgency: UrgencyConfig;
  externos: { id: string; name: string }[];
}) {
  const [data, setData] = useState<NewJobData | null>(null);
  useEffect(() => {
    if (open && !data) getNewJobData().then(setData);
  }, [open, data]);
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <EditForm job={job} close={() => onOpenChange(false)} cfg={urgency} externos={externos} data={data} />}</DialogRoot>;
}

function EditForm({ job, close, cfg, externos, data }: { job: JobJSON; close: () => void; cfg: UrgencyConfig; externos: { id: string; name: string }[]; data: NewJobData | null }) {
  const router = useRouter();
  const { openRefund } = useJobDialogs();
  const [pending, start] = useTransition();
  const m = useMoney(job);
  const [urg, setUrg] = useState<Urgency>(job.urgency);
  const [lines, setLines] = useState<Line[]>(() =>
    job.items.map((i) => ({
      key: i.id,
      jobItemId: i.id,
      serviceItemId: i.serviceItemId ?? "",
      code: i.code,
      name: i.categoryCode === "OT" ? (i.detail ?? i.name) : i.name,
      unit: i.unit ?? "",
      pricingMode: i.pricingMode,
      basePrice: i.basePrice,
      frozenFactor: i.factor,
      unitHours: i.quantity ? i.hours / i.quantity : 0,
      quantity: i.quantity,
      isCustom: i.categoryCode === "OT",
      detail: i.detail ?? "",
      done: !!i.doneAt,
    })),
  );
  const [showItems, setShowItems] = useState(false);
  const [extra, setExtra] = useState(job.complexityExtra);
  const [discount, setDiscount] = useState(job.discount);
  const [course, setCourse] = useState(job.course ?? "");
  const [professor, setProfessor] = useState(job.professor ?? "");
  const [title, setTitle] = useState(job.title);
  const [ext, setExt] = useState<string>(job.externoId ?? "");
  const [reason, setReason] = useState("");

  const pct = urg === job.urgency ? job.urgencyPct : cfg[urg].pct;
  const subtotal = round2(lines.reduce((a, l) => a + lineTotal(l, l.frozenFactor ?? 1), 0));
  const price = Math.max(0, round2(subtotal * (1 + pct / 100) + extra - discount));
  const total = round2(price + m.extras);
  const overpaid = round2(Math.max(0, m.paid - total));
  const pendingAfter = round2(Math.max(0, total - m.paid));

  // Vista previa de la entrega según el plazo del nivel.
  const [openedAt] = useState(() => Date.now());
  const preview = useMemo(() => {
    if (urg === job.urgency) return null;
    const byPlazo = new Date(openedAt + cfg[urg].hours * 3_600_000);
    const up = cfg[urg].pct > job.urgencyPct;
    const cur = new Date(job.dueAt);
    return up ? (byPlazo < cur ? byPlazo : cur) : byPlazo > cur ? byPlazo : cur;
  }, [urg, job.urgency, job.urgencyPct, job.dueAt, cfg, openedAt]);

  const save = () =>
    start(async () => {
      const r = await editJob({
        jobId: job.id,
        urgency: urg,
        items: lines.map((l) => ({
          serviceItemId: l.serviceItemId,
          jobItemId: l.jobItemId,
          quantity: l.quantity,
          ...(l.isCustom ? { detail: l.detail, customPrice: l.basePrice, hours: l.unitHours } : {}),
        })),
        complexityExtra: extra,
        discount,
        course: course || undefined,
        professor: professor || undefined,
        section: job.section ?? undefined,
        title,
        externoId: ext ? ext : job.externoId ? null : undefined,
        reason,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Cambios guardados.");
      close();
      router.refresh();
      if (r.data && r.data.overpaid > 0) openRefund({ jobId: job.id, amount: r.data.overpaid, reason: "pago_de_mas" });
    });

  const changedDir = cfg[urg].pct > job.urgencyPct ? "up" : cfg[urg].pct < job.urgencyPct ? "down" : null;

  return (
    <DialogContent
      wide
      title="Editar trabajo"
      description={`${job.code} · ${job.title}`}
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancelar
          </Button>
          <Button size="md" variant="primary" onClick={save} disabled={pending || reason.trim().length < 3}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Urgencia">
          <Choice
            label="Urgencia"
            value={urg}
            onChange={setUrg}
            size="lg"
            options={URGENCIES.map((u) => ({
              value: u,
              label: (
                <>
                  {URGENCY_LABEL[u]}
                  {u === job.urgency && u !== urg && <span className="ml-1.5 font-mono text-[10px] text-faint">antes</span>}
                </>
              ),
              sub: (
                <span className="text-faint">
                  plazo {formatDeadline(cfg[u].hours)} · <span className={cfg[u].pct ? "text-danger" : ""}>{cfg[u].pct ? `+${cfg[u].pct} %` : "0 %"}</span>
                </span>
              ),
            }))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-surface px-3.5 py-3">
            <p className="font-mono text-[11px] text-muted">Entrega · se ajusta al plazo</p>
            <p className="mt-1 text-sm">
              {preview ? (
                <>
                  {dayKey(preview) === todayLima() ? "Hoy" : `${weekdayShort(preview)} ${dayMonthNum(preview)}`} {timeLima(preview)}{" "}
                  <span className="text-faint line-through">
                    {weekdayShort(job.dueAt)} {dayMonthNum(job.dueAt)}
                  </span>
                </>
              ) : (
                <>
                  {weekdayShort(job.dueAt)} {dayMonthNum(job.dueAt)} {timeLima(job.dueAt)}
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setShowItems((v) => !v)} className="press rounded-lg border bg-surface px-3.5 py-3 text-left hover-fine:hover:border-border-strong">
            <p className="font-mono text-[11px] text-muted">Ítems · adicional · descuento</p>
            <p className="mt-1 text-sm">
              {lines.length} ítems · {formatMoney(extra)} · {formatMoney(discount)} <span className="text-info">{showItems ? "Ocultar" : "Editar ítems"}</span>
            </p>
          </button>
        </div>
        {showItems && (
          <div className="enter flex flex-col gap-3">
            {data ? <LinesEditor lines={lines} setLines={setLines} tarifario={data.tarifario} factor={job.cycle ? (data.cycleFactors[String(job.cycle)] ?? 1) : 1} cycle={job.cycle} /> : <p className="text-xs text-faint">Cargando el tarifario…</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Adicional por complejidad">
                <Stepper label="Adicional" value={extra} step={5} prefix="S/" onChange={setExtra} />
              </Field>
              <Field label="Descuento">
                <Stepper label="Descuento" value={discount} step={5} prefix="S/" onChange={setDiscount} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Curso" optional>
                <Input value={course} onChange={(e) => setCourse(e.target.value)} />
              </Field>
              <Field label="Profesor" optional>
                <Input value={professor} onChange={(e) => setProfessor(e.target.value)} />
              </Field>
            </div>
            <Field label="Qué pide">
              <Textarea value={title} onChange={(e) => setTitle(e.target.value)} className="min-h-14" />
            </Field>
            <Field label="Responsable" hint="Solo se puede encargar a un externo. Nadie pone a otra persona del estudio: el trabajo va a Por tomar.">
              <select value={ext} onChange={(e) => setExt(e.target.value)} aria-label="Encargar a un externo" className="h-10 rounded-md border bg-surface px-3 text-sm">
                <option value="">{job.responsible ? `Sigue con ${job.responsible.name}` : "Sin externo"}</option>
                {externos.map((x) => (
                  <option key={x.id} value={x.id}>
                    Externo · {x.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border">
          <p className="border-b px-3.5 py-2 font-mono text-[11px] text-muted">Así queda el precio</p>
          <div className="grid grid-cols-3 text-[13px]">
            <div className="px-3.5 py-2.5">
              <p className="font-mono text-[10.5px] text-muted">Precio</p>
              <p className="font-mono">
                {formatMoney(total)} {total !== m.total && <span className="text-xs text-faint line-through">{m.total.toFixed(2)}</span>}
              </p>
            </div>
            <div className="border-l px-3.5 py-2.5">
              <p className="font-mono text-[10.5px] text-muted">Pagado</p>
              <p className="font-mono">{formatMoney(m.paid)}</p>
            </div>
            <div className="border-l px-3.5 py-2.5">
              {overpaid > 0 ? (
                <>
                  <p className="font-mono text-[10.5px] text-muted">Pagado de más</p>
                  <p className="font-mono text-warning">{formatMoney(overpaid)}</p>
                </>
              ) : (
                <>
                  <p className="font-mono text-[10.5px] text-muted">Pendiente</p>
                  <p className={cn("font-mono", pendingAfter > 0 && "text-warning")}>{formatMoney(pendingAfter)}</p>
                </>
              )}
            </div>
          </div>
          {overpaid > 0 && <p className="border-t px-3.5 py-2 text-xs text-danger">Al guardar se abre la devolución de {formatMoney(overpaid)} ya llena.</p>}
        </div>
        <Field
          label={
            <>
              Motivo · <span className="text-faint">obligatorio</span>
            </>
          }
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="El cliente lo necesita para hoy en la tarde." className="min-h-14" />
        </Field>
        {changedDir && (
          <p className="text-xs text-muted">
            {changedDir === "up"
              ? "Sube el precio y la entrega se acorta al plazo del nivel. La diferencia queda pendiente. El atraso se mide contra la nueva fecha."
              : "Baja el precio. Si ya pagó más, se abre la devolución ya llena. Al guardar queda en el Historial con motivo."}
          </p>
        )}
      </div>
    </DialogContent>
  );
}

/* ---------- Anular pedido (RF-63) ---------- */

export function CancelDialog({ job, open, onOpenChange, driveReady }: { job: JobJSON; open: boolean; onOpenChange: (v: boolean) => void; driveReady: boolean }) {
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <CancelForm job={job} close={() => onOpenChange(false)} driveReady={driveReady} />}</DialogRoot>;
}

function CancelForm({ job, close, driveReady }: { job: JobJSON; close: () => void; driveReady: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const m = useMoney(job);
  const [reason, setReason] = useState<CancelInput["reasonKind"] | null>(null);
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(false);
  const [amount, setAmount] = useState(m.paid);
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [day, setDay] = useState(todayLima());
  const [op, setOp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const firstPay = job.payments.find((p) => p.kind === "pago" && !p.voidedAt);
  const done = job.items.filter((i) => i.doneAt).length;

  const confirm = () => {
    if (!reason) return void toast.error("Elige el motivo");
    start(async () => {
      const r = await cancelJob({ jobId: job.id, reasonKind: reason, note: note || undefined, refund, amount: refund ? amount : undefined, method: refund ? method : undefined, paidDate: day, operationNumber: op || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${job.code} pasó a Cancelado.`);
      close();
      router.refresh();
    });
  };

  return (
    <DialogContent
      wide
      eyebrow={`02 · Trabajos · ${job.code}`}
      title="Anular pedido"
      description="Para trabajos que quedaron en el aire. El motivo queda en la ficha, en Pagos y en el Historial."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs leading-snug text-faint">
            Después de anular
            <br />
            <span className="text-danger">
              Cancelado · {refund ? `devuelve ${formatMoney(amount)} · se queda ${formatMoney(Math.max(0, m.paid - amount))}` : `se queda ${formatMoney(m.paid)}`}
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="md" onClick={close}>
              Volver
            </Button>
            <HoldButton onConfirm={confirm} disabled={!reason}>
              <AlertTriangle className="size-4" /> Mantén 2 s para anular
            </HoldButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <JobHead job={job} note={job.responsible ? `lo tiene ${job.responsible.name}` : "sin tomar"} />
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
            onChange={setReason}
            size="sm"
            options={(Object.keys(CANCEL_REASON) as CancelInput["reasonKind"][]).map((k) => ({ value: k, label: CANCEL_REASON[k] }))}
          />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="No responde desde el 18/11. Se le escribió 3 veces por WhatsApp." className="mt-1.5 min-h-14" />
        </Field>
        {m.paid > 0 && (
          <Field label={`Lo que ya pagó · ${formatMoney(m.paid)}`}>
            <Choice
              label="Qué hacer con lo pagado"
              value={refund ? "devolver" : "queda"}
              onChange={(v) => setRefund(v === "devolver")}
              options={[
                { value: "queda", label: "Se queda con lo pagado" },
                { value: "devolver", label: "Devolver dinero" },
              ]}
            />
          </Field>
        )}
        {refund && (
          <div className="enter flex flex-col gap-3 rounded-lg border bg-surface p-3.5">
            <Field label="Monto a devolver" aside={<span className="font-mono text-[11px] text-faint">se escribe libre</span>}>
              <div className="flex flex-wrap gap-1.5">
                <Stepper label="Monto a devolver" value={amount} prefix="− S/" step={10} decimals={2} max={m.paid} onChange={setAmount} className="w-44" />
                <Button size="md" onClick={() => setAmount(m.paid)}>
                  Todo lo pagado · {formatMoney(m.paid)}
                </Button>
                {firstPay && (
                  <Button size="md" onClick={() => setAmount(firstPay.amount)}>
                    Lo del adelanto · {formatMoney(firstPay.amount)}
                  </Button>
                )}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr]">
              <Choice label="Medio" value={method} onChange={setMethod} options={METHODS.map((x) => ({ value: x, label: METHOD_LABEL[x] }))} size="sm" />
              <Input type="date" value={day} max={todayLima()} onChange={(e) => setDay(e.target.value)} className="h-8" aria-label="Fecha" />
              <Input value={op} onChange={(e) => setOp(e.target.value)} placeholder="N.º operación" className="h-8 font-mono" />
            </div>
            <DropZone file={file} onFile={setFile} title="Pega o arrastra la captura de la devolución · opcional" where={`Drive › ${job.code} › Pagos`} disabledHint={driveReady ? null : "Drive sin conectar."} />
          </div>
        )}
        <div className="rounded-lg border border-dashed border-border-strong px-3.5 py-3 text-[12.5px] text-muted">
          <p className="mb-1 font-medium text-fg-2">Qué pasa al anular</p>
          <p>
            • Pasa a <span className="text-danger">Cancelado</span>: sale de Por tomar, de la Agenda y del Inicio.
          </p>
          {done > 0 && <p>• Lo hecho ({done} {done === 1 ? "ítem" : "ítems"}) queda a nombre de quien lo hizo.</p>}
          <p>• No se borra: se ve en Trabajos › Todos y en el Historial. Se puede reabrir si no se devolvió dinero.</p>
        </div>
      </div>
    </DialogContent>
  );
}

/* ---------- Anular un pago (RF-16, solo admin) ---------- */

export function VoidPaymentDialog({ payment, onClose }: { payment: { id: string; amount: number; label: string } | null; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  return (
    <DialogRoot open={!!payment} onOpenChange={(v) => !v && onClose()}>
      {payment && (
        <DialogContent
          title={`Anular ${payment.label.toLowerCase()} de ${formatMoney(payment.amount)}`}
          description="No se borra: queda tachado con quién, cuándo y por qué. Ese monto vuelve a quedar pendiente."
          footer={
            <>
              <Button size="md" onClick={onClose}>
                Volver
              </Button>
              <Button
                size="md"
                variant="danger"
                disabled={pending || reason.trim().length < 3}
                onClick={() =>
                  start(async () => {
                    const r = await voidPayment(payment.id, reason);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Pago anulado.");
                    onClose();
                    router.refresh();
                  })
                }
              >
                Anular pago
              </Button>
            </>
          }
        >
          <Field label="Motivo · obligatorio">
            <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="La captura era de otro pedido" className="min-h-14" />
          </Field>
        </DialogContent>
      )}
    </DialogRoot>
  );
}
