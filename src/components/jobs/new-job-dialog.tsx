"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock, FileText, Info, Link2 } from "lucide-react";
import { toast } from "sonner";
import { clientContext, createJob, sameCourseJobs, type ClientContext, type ClientHit, type CourseMatch } from "@/actions/jobs";
import type { NewJobData } from "@/actions/catalog";
import { computeTotal, cycleFactor, formatDeadline, METHOD_LABEL, METHODS, round2, URGENCIES, URGENCY_LABEL } from "@/lib/domain";
import { dayKey, timeLima, todayLima } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { createJobSchema } from "@/lib/validation/jobs";
import type { PaymentMethod, Urgency } from "@/db/schema";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FormSection, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";
import { DropZone } from "@/components/ui/drop-zone";
import { ClientCard, ClientPicker, type NewClient } from "@/components/jobs/client-picker";
import { LinesEditor, lineTotal, type Line } from "@/components/jobs/lines-editor";
import { ClientSummaryDialog, type SummaryData } from "@/components/jobs/client-summary";

export type NewJobPrefill = {
  client?: ClientHit;
  continues?: { id: string; code: string; title: string; finishedAt: string | null; cycle: number; course: string | null; professor: string | null; section: string | null; retake?: boolean };
};

type Who = "pozo" | "yo" | "externo";

/** Fecha de entrega según el plazo de la urgencia (RF-57). */
function dueFor(hours: number) {
  const d = new Date(Date.now() + hours * 3_600_000);
  if (hours >= 48) return { day: dayKey(d), time: "18:00" };
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { day: dayKey(d), time: timeLima(d) };
}

export function NewJobDialog({ open, onOpenChange, data, prefill }: { open: boolean; onOpenChange: (v: boolean) => void; data: NewJobData | null; prefill: NewJobPrefill | null }) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {open && data && <NewJobForm data={data} prefill={prefill} close={() => onOpenChange(false)} />}
    </DialogRoot>
  );
}

function NewJobForm({ data, prefill, close }: { data: NewJobData; prefill: NewJobPrefill | null; close: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cont = prefill?.continues;

  const [client, setClient] = useState<ClientHit | null>(prefill?.client ?? null);
  const [newClient, setNewClient] = useState<NewClient | null>(null);
  const [loadedCtx, setCtx] = useState<ClientContext | null>(null);
  const [cycle, setCycle] = useState<number | null>(cont?.cycle ?? prefill?.client?.cycle ?? null);
  const [course, setCourse] = useState(cont?.course ?? "");
  const [professor, setProfessor] = useState(cont?.professor ?? "");
  const [section, setSection] = useState(cont?.section ?? "");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [extra, setExtra] = useState(0);
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const initialDue = dueFor(data.urgency.normal.hours);
  const [dueDay, setDueDay] = useState(initialDue.day);
  const [dueTime, setDueTime] = useState(initialDue.time);
  const [status, setStatus] = useState<"cotizacion" | "confirmado">("cotizacion");
  const [advance, setAdvance] = useState(0);
  const [advanceTouched, setAdvanceTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("yape");
  const [op, setOp] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [who, setWho] = useState<Who>("pozo");
  const [externoId, setExternoId] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<CourseMatch[]>([]);
  const [linkTo, setLinkTo] = useState<string | null>(cont?.id ?? null);
  const [dupAsk, setDupAsk] = useState<{ code: string } | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  // Al elegir al cliente: avisos y preferencias (RF-38, RF-45, RF-46).
  useEffect(() => {
    if (!client) return;
    let alive = true;
    clientContext(client.id).then((c) => {
      if (!alive || !c) return;
      setCtx(c);
      setCycle((v) => v ?? c.client.cycle ?? null);
    });
    return () => {
      alive = false;
    };
  }, [client]);

  const ctx = client && loadedCtx?.client.id === client.id ? loadedCtx : null;

  // RF-35: aviso de trabajos del mismo curso (con un respiro al escribir).
  useEffect(() => {
    const t = setTimeout(async () => {
      setMatches(await sameCourseJobs({ clientId: client?.id, course, professor, university: client?.university ?? newClient?.university, dueDate: dueDay }));
    }, 350);
    return () => clearTimeout(t);
  }, [course, professor, client, newClient?.university, dueDay]);

  const factor = cycleFactor(data.cycleFactors, cycle);
  const pct = data.urgency[urgency].pct;
  const totals = useMemo(
    () =>
      computeTotal(
        lines.map((l) => ({ basePrice: l.basePrice, quantity: l.quantity, pricingMode: l.pricingMode, hours: l.unitHours })),
        factor,
        pct,
        extra,
      ),
    [lines, factor, pct, extra],
  );
  const total = totals.total;
  const advanceValue = advanceTouched ? advance : round2(total / 2);

  const prefixPreview = useMemo(() => {
    const first = lines.find((l) => !l.isCustom);
    if (!first) return lines.length ? "OT" : "··";
    return data.tarifario.find((t) => t.id === first.serviceItemId)?.categoryCode === "PC" ? "PC" : first.code.split("-")[0].slice(0, 2);
  }, [lines, data.tarifario]);
  const yy = todayLima().slice(2, 4);
  const clientName = client?.name ?? newClient?.name ?? "";

  const changeUrgency = (u: Urgency) => {
    setUrgency(u);
    const d = dueFor(data.urgency[u].hours);
    setDueDay(d.day);
    setDueTime(d.time);
  };

  const submit = (force = false) => {
    const payload = {
      clientId: client?.id,
      newClient: !client && newClient ? { ...newClient, university: newClient.university || undefined, career: newClient.career || undefined } : undefined,
      cycle: cycle ?? 0,
      course: course || undefined,
      professor: professor || undefined,
      section: section || undefined,
      title,
      items: lines.map((l) => ({
        serviceItemId: l.serviceItemId,
        quantity: l.quantity,
        ...(l.isCustom ? { detail: l.detail, customPrice: l.basePrice, hours: l.unitHours } : {}),
      })),
      complexityExtra: extra,
      dueDate: dueDay,
      dueTime,
      urgency,
      initialStatus: status,
      advance: status === "confirmado" && advanceValue > 0 ? { amount: advanceValue, method, operationNumber: op || undefined } : undefined,
      who,
      externoId: who === "externo" ? externoId || undefined : undefined,
      continuesJobId: linkTo ?? undefined,
      software: ctx?.client.software ?? undefined,
      deliveryFormat: ctx?.client.usualFormat ?? undefined,
    };
    const check = createJobSchema.safeParse(payload);
    if (!check.success) {
      const errs: Record<string, string> = {};
      for (const i of check.error.issues) {
        const k = String(i.path[0] ?? "form");
        errs[k] ??= i.message;
      }
      setErrors(errs);
      toast.error(check.error.issues[0]?.message ?? "Revisa el formulario");
      return;
    }
    setErrors({});
    // RF-37: si el cliente ya tiene un trabajo abierto del mismo curso, se pregunta.
    if (!force && ctx && !linkTo) {
      const same = ctx.openJobs.find((j) => course && j.course && j.course.toLowerCase() === course.toLowerCase());
      if (same) {
        setDupAsk({ code: same.code });
        return;
      }
    }
    start(async () => {
      const r = await createJob(payload);
      if (!r.ok) {
        toast.error(r.error);
        if (r.fieldErrors) setErrors(Object.fromEntries(Object.entries(r.fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
        return;
      }
      toast.success(`${r.data!.code} creado${status === "cotizacion" ? " como cotización" : ""}.`);
      if (files.length || receipt) toast.message("Los archivos se suben cuando Drive esté conectado.");
      close();
      router.push(`/trabajos/${r.data!.code}`);
      router.refresh();
    });
  };

  const summaryData: SummaryData = {
    code: `${prefixPreview}${yy}-···`,
    date: new Date().toISOString(),
    clientName: clientName || "Cliente",
    course: course || null,
    cycle,
    dueAt: new Date(`${dueDay}T${dueTime}:00-05:00`).toISOString(),
    urgency,
    deadlineLabel: formatDeadline(data.urgency[urgency].hours),
    lines: lines.map((l) => ({ name: l.isCustom ? l.detail || "Pedido personalizado" : l.name, quantity: l.quantity, unit: l.unit, amount: lineTotal(l, factor) })),
    subtotal: totals.subtotal,
    surcharge: totals.surcharge,
    extra,
    total,
    paid: status === "confirmado" ? advanceValue : 0,
    studio: data.studio,
    clientPhone: client?.whatsapp ?? newClient?.whatsapp ?? null,
    isQuote: status === "cotizacion",
  };

  return (
    <>
      <DialogContent
        wide="xl"
        eyebrow="02 · Trabajos · nuevo"
        title={cont ? (cont.retake ? "Nuevo pedido desde este" : "Continuar trabajo") : "Nuevo trabajo"}
        className="max-h-[calc(100dvh-24px)]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="hidden text-xs leading-snug text-faint md:block">
              Si ya tiene un trabajo abierto parecido,
              <br />
              te preguntamos si es el mismo antes de crearlo.
            </p>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="md" onClick={() => setSummary(summaryData)} disabled={lines.length === 0}>
                <FileText /> Resumen
              </Button>
              <Button variant="secondary" size="md" onClick={close}>
                Descartar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => submit()}
                disabled={pending || (status === "confirmado" && advanceValue + 0.004 < round2(total / 2))}
                title={status === "confirmado" && advanceValue + 0.004 < round2(total / 2) ? `Para confirmar, el adelanto debe ser al menos ${formatMoney(round2(total / 2))} (50 %)` : undefined}
              >
                {pending ? "Guardando…" : status === "cotizacion" ? "Guardar cotización" : advanceValue > 0 ? "Crear trabajo y adelanto" : "Crear trabajo"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-7">
            {cont && (
              <div className="flex items-start gap-2.5 rounded-lg border border-info-line bg-info-soft px-3 py-2.5 text-[13px]">
                <Link2 className="mt-0.5 size-4 shrink-0 text-info" />
                <p>
                  {cont.retake ? "Retoma" : "Continúa"} <b className="font-medium">{cont.code} · {cont.title}</b>
                  <span className="block text-xs text-muted">Copiamos cliente, curso, profesor y ciclo. Agrega solo lo nuevo.</span>
                </p>
              </div>
            )}

            <FormSection n="01" title={newClient ? "Cliente nuevo" : "Cliente"}>
              {client ? (
                <ClientCard c={client} onChange={cont ? undefined : () => setClient(null)} />
              ) : (
                <ClientPicker onPick={setClient} newClient={newClient} setNewClient={setNewClient} error={errors.clientId || errors.newClient} />
              )}
              {ctx && !cont && ctx.finished.length > 0 && !linkTo && (
                <div className="flex items-center gap-3 rounded-lg border border-info-line bg-info-soft px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1">
                    Este cliente tiene <b className="font-medium">{ctx.finished[0].code}</b> finalizado. ¿Es continuación?
                  </span>
                  <Button size="sm" onClick={() => setLinkTo(ctx.finished[0].id)}>
                    Vincular
                  </Button>
                </div>
              )}
              {linkTo && !cont && ctx && (
                <p className="text-xs text-info">
                  Vinculado como continuación de {ctx.finished.find((f) => f.id === linkTo)?.code}.{" "}
                  <button type="button" className="underline" onClick={() => setLinkTo(null)}>
                    Quitar
                  </button>
                </p>
              )}
            </FormSection>

            <FormSection n="02" title="Trabajo">
              <Field
                label={
                  <>
                    Ciclo de la carrera <span className="text-danger">*</span>
                  </>
                }
                aside={cycle && factor !== 1 ? <span className="font-mono text-[11px] text-muted">×{factor.toFixed(2)} en ítems ×C</span> : null}
                error={errors.cycle}
              >
                <Choice
                  label="Ciclo de la carrera"
                  value={cycle ? String(cycle) : null}
                  onChange={(v) => setCycle(Number(v))}
                  options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                  size="sm"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_90px]">
                <Field label="Curso" optional>
                  <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Taller de Diseño 3" />
                </Field>
                <Field label="Profesor" optional>
                  <Input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Sin indicar" />
                </Field>
                <Field label="Sección" optional>
                  <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="B" />
                </Field>
              </div>
              <Field label="Qué pide" error={errors.title}>
                <Textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vivienda de 2 niveles: plano cero, 2 cortes, 2 elevaciones…" className="min-h-[68px]" />
              </Field>
            </FormSection>

            <FormSection n="03" title="Lo que se cobra · del tarifario">
              <LinesEditor lines={lines} setLines={setLines} tarifario={data.tarifario} factor={factor} cycle={cycle} error={errors.items} />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2.5">
                <span className="text-[13px]">
                  Adicional por complejidad <span className="text-faint">· opcional</span>
                  <span className="block text-xs text-faint">Lo que el cliente pida de más.</span>
                </span>
                <Stepper label="Adicional por complejidad" value={extra} step={5} prefix="S/" onChange={setExtra} className="w-36" />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr]">
                <Field label="Fecha de entrega">
                  <div className="flex gap-2">
                    <Input type="date" value={dueDay} min={todayLima()} onChange={(e) => setDueDay(e.target.value)} className="min-w-0 flex-1" />
                    <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-[92px]" aria-label="Hora de entrega" />
                  </div>
                </Field>
                <Field
                  label="Urgencia"
                  aside={
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-primary px-2 text-[11px] font-medium text-on-primary">
                      <Clock className="size-3" />
                      plazo {formatDeadline(data.urgency[urgency].hours)}
                    </span>
                  }
                >
                  <Choice
                    label="Urgencia"
                    value={urgency}
                    onChange={changeUrgency}
                    options={URGENCIES.map((u) => ({
                      value: u,
                      label: URGENCY_LABEL[u],
                      sub: <span className={data.urgency[u].pct ? "text-danger" : "text-faint"}>{data.urgency[u].pct ? `+${data.urgency[u].pct}%` : "0%"}</span>,
                    }))}
                    size="lg"
                  />
                </Field>
              </div>
              <div className="flex items-end justify-between gap-4 rounded-lg border bg-bg px-4 py-3">
                <span>
                  <span className="block text-[13px] text-fg-2">Total a cobrar</span>
                  <span className="block font-mono text-[11.5px] text-faint">{totals.hours} h aprox. · 2 correcciones incluidas</span>
                </span>
                <span key={total} className="number-pop font-mono text-[28px] font-medium tracking-tight">
                  {formatMoney(total)}
                </span>
              </div>

              <Field label="Estado inicial" aside={<span className="font-mono text-[11px] text-faint">{status === "cotizacion" ? "por defecto" : "al confirmar se abre lo de abajo"}</span>}>
                <Choice
                  label="Estado inicial"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "cotizacion", label: "Cotización" },
                    { value: "confirmado", label: "Confirmado" },
                  ]}
                />
              </Field>
              {status === "cotizacion" ? (
                <p className="flex items-start gap-2 rounded-md border border-dashed border-border-strong px-3 py-2.5 text-[12.5px] text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Se guarda como cotización en Inicio › Cotizaciones. No entra a Trabajos por tomar hasta que el cliente pague el adelanto y la confirmes.
                </p>
              ) : (
                <div className="enter flex flex-col gap-4">
                  <div className="flex flex-col gap-3 rounded-lg border bg-surface p-3.5">
                    <p className="text-[13px] font-medium">
                      Adelanto <span className="font-normal text-faint">· 50 % ahora, 50 % contra entrega</span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                      <Field label="Monto del adelanto">
                        <div className="flex gap-1.5">
                          <Stepper
                            label="Monto del adelanto"
                            value={advanceValue}
                            step={10}
                            prefix="S/"
                            decimals={2}
                            onChange={(v) => {
                              setAdvanceTouched(true);
                              setAdvance(v);
                            }}
                            className="min-w-0 flex-1"
                          />
                          <Button size="md" onClick={() => (setAdvanceTouched(true), setAdvance(round2(total / 2)))}>
                            50 %
                          </Button>
                          <Button size="md" onClick={() => (setAdvanceTouched(true), setAdvance(total))}>
                            Todo
                          </Button>
                        </div>
                      </Field>
                      <div className="flex flex-col justify-end rounded-md bg-bg px-3 py-2">
                        {advanceValue + 0.004 < round2(total / 2) && <span className="mb-1 text-xs text-danger">Mínimo 50 %: {formatMoney(round2(total / 2))}</span>}
                        <span className="font-mono text-[11px] text-muted">Queda por cobrar</span>
                        <span className="font-mono text-lg text-warning">{formatMoney(Math.max(0, total - advanceValue))}</span>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
                      <Field label="Medio">
                        <Choice label="Medio de pago" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} size="sm" />
                      </Field>
                      <Field label="N.º de operación" optional>
                        <Input value={op} onChange={(e) => setOp(e.target.value)} className="h-8 font-mono" />
                      </Field>
                    </div>
                    <DropZone
                      file={receipt}
                      onFile={setReceipt}
                      where={`Drive › ${prefixPreview}${yy}-··· › Pagos`}
                      disabledHint={data.driveReady ? null : "Drive sin conectar: la captura se podrá subir cuando el admin lo conecte."}
                    />
                  </div>
                  <Field label="Quién lo hace" error={errors.externoId}>
                    <Choice
                      label="Quién lo hace"
                      value={who}
                      onChange={setWho}
                      options={[
                        { value: "pozo", label: "Por tomar" },
                        { value: "yo", label: "Lo hago yo", disabled: !data.canTake },
                        { value: "externo", label: "Externo", disabled: data.externos.length === 0 },
                      ]}
                    />
                  </Field>
                  {who === "pozo" && (
                    <p className="flex items-start gap-2 rounded-md border border-dashed border-border-strong px-3 py-2.5 text-[12.5px] text-muted">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      Aparecerá en Inicio › Trabajos para que alguien de Producción lo tome.
                    </p>
                  )}
                  {who === "externo" && (
                    <select
                      value={externoId}
                      onChange={(e) => setExternoId(e.target.value)}
                      aria-label="Externo"
                      className="h-10 rounded-md border bg-surface px-3 text-sm"
                    >
                      <option value="">Elige al externo…</option>
                      {data.externos.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                          {x.skills.length ? ` · ${x.skills.slice(0, 3).join(", ")}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </FormSection>

            <FormSection n="04" title="Lo que mandó el cliente" aside={<span className="font-mono text-[11px] text-faint">opcional</span>}>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-2.5 text-[12.5px]">
                      <span className="font-mono text-[10px] text-muted">{f.name.split(".").pop()?.toUpperCase()}</span>
                      {f.name}
                      <button type="button" aria-label="Quitar" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-faint hover-fine:hover:text-fg">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <DropZone
                file={null}
                onFile={(f) => f && setFiles((p) => [...p, f])}
                accept="*"
                title="Arrastra o elige los archivos del cliente"
                where="Se guardan en la subcarpeta Recibido al crear el trabajo"
                disabledHint={data.driveReady ? null : "Drive sin conectar: los archivos se suben desde la ficha cuando el admin lo conecte."}
              />
            </FormSection>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
            <div className="rounded-lg border bg-surface px-3.5 py-3">
              <p className="font-mono text-[11px] text-muted">Código</p>
              <p className="mt-1 font-mono text-xl">
                {prefixPreview}
                {yy}-···
              </p>
              <p className="mt-0.5 text-xs text-faint">Se asigna al guardar y ya no cambia.</p>
            </div>
            <div className="rounded-lg border bg-surface px-3.5 py-3">
              <p className="font-mono text-[11px] text-muted">Carpeta en Drive</p>
              <p className="mt-1 text-[13px] break-words">
                {prefixPreview}
                {yy}-··· - {clientName || "Cliente"} - {title ? title.slice(0, 32) : "Descripción corta"}
              </p>
              <p className="mt-1 text-xs text-faint">Recibido · Avances · Entrega final</p>
            </div>
            <Avisos ctx={ctx} matches={matches} />
          </aside>
        </div>
      </DialogContent>

      {/* RF-37: confirmación de pedido repetido */}
      <DialogRoot open={!!dupAsk} onOpenChange={(v) => !v && setDupAsk(null)}>
        {dupAsk && (
          <DialogContent
            title="¿Es un pedido nuevo o es el mismo?"
            description={`Este cliente ya tiene abierto ${dupAsk.code} del mismo curso.`}
            footer={
              <>
                <Button
                  size="md"
                  onClick={() => {
                    close();
                    router.push(`/trabajos/${dupAsk.code}`);
                  }}
                >
                  Es el mismo: ir a {dupAsk.code}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setDupAsk(null);
                    submit(true);
                  }}
                >
                  Es nuevo: crearlo
                </Button>
              </>
            }
          >
            <p className="text-sm text-muted">Si es lo mismo, mejor sigue en el trabajo que ya existe para no duplicarlo.</p>
          </DialogContent>
        )}
      </DialogRoot>
      <ClientSummaryDialog data={summary} onClose={() => setSummary(null)} />
    </>
  );
}

function Avisos({ ctx, matches }: { ctx: ClientContext | null; matches: CourseMatch[] }) {
  const prefs = ctx ? [ctx.client.software, ctx.client.softwareVersion, ctx.client.usualFormat].filter(Boolean).join(" · ") : "";
  const hasAny = ctx && (ctx.debts.length || ctx.alerts.length || prefs || ctx.usualPerson);
  if (!ctx && matches.length === 0)
    return <p className="px-1 text-xs leading-relaxed text-faint">Al elegir al cliente aparecen aquí sus avisos (deuda, trabajos del mismo curso) y sus preferencias.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 font-mono text-[11px] text-muted">Avisos</p>
      {ctx?.debts.map((d) => (
        <Aviso key={d.code} tone="warning" title={`Debe ${formatMoney(d.pending)}`}>
          De {d.code}. Es solo un aviso.
        </Aviso>
      ))}
      {matches.length > 0 && (
        <Aviso tone="info" title={`${matches.length} ${matches.length === 1 ? "trabajo" : "trabajos"} del mismo curso${matches.every((m) => !m.sure) ? " · posible coincidencia" : ""}`}>
          {matches
            .slice(0, 4)
            .map((m) => `${m.code}${m.who ? ` (${m.who})` : ""}`)
            .join(", ")}
          . Que salgan distintos.
        </Aviso>
      )}
      {ctx?.alerts.map((a, i) => (
        <Aviso key={i} tone="warning" title="Observación del cliente">
          {a.body}
        </Aviso>
      ))}
      {ctx && (prefs || ctx.usualPerson) && (
        <div className="rounded-lg border bg-surface px-3 py-2.5 text-xs">
          <p className="mb-0.5 text-[12.5px] font-medium">Preferencias de {ctx.client.name.split(" ")[0]}</p>
          <p className="text-muted">
            {[prefs, ctx.usualPerson ? `suele trabajar con ${ctx.usualPerson}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
      {ctx && !hasAny && matches.length === 0 && <p className="px-1 text-xs text-faint">Sin avisos para este cliente.</p>}
    </div>
  );
}

function Aviso({ tone, title, children }: { tone: "warning" | "info"; title: string; children: React.ReactNode }) {
  return (
    <div className="enter flex gap-2.5 rounded-lg border bg-surface px-3 py-2.5">
      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", tone === "warning" ? "bg-warning" : "bg-info")} />
      <span className="min-w-0 text-xs text-muted">
        <span className="mb-0.5 block text-[12.5px] font-medium text-fg">{title}</span>
        {children}
      </span>
    </div>
  );
}
