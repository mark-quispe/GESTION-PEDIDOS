"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { CircleAlert, Link2, Search, UserPlus } from "lucide-react";
import { searchClients } from "@/actions/clients";
import { checkJobWarnings, createJob, getClientForJob, listClientJobs, updateJob } from "@/actions/jobs";
import type { JobStatus } from "@/db/schema";
import { JOB_STATUSES, STATUS_HINTS, STATUS_LABELS, URGENCIES, URGENCY_LABELS, formatWhatsapp } from "@/lib/domain";
import type { JobWarnings } from "@/lib/queries";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ClientForm } from "@/components/clients/client-form";

type Option = { id: string; name: string; active: boolean };
type ServiceOption = Option & { prefix: string };
type ClientInfo = NonNullable<Awaited<ReturnType<typeof getClientForJob>>>;
type ClientJob = Awaited<ReturnType<typeof listClientJobs>>[number];

export type JobFormValues = {
  serviceTypeId: string;
  course: string;
  professor: string;
  section: string;
  academicTerm: string;
  description: string;
  dueDate: string;
  urgency: (typeof URGENCIES)[number];
  price: string;
  responsableId: string;
  status: JobStatus;
  parentJobId: string;
};

function preferenceLine(c: ClientInfo) {
  const parts = [c.software && `Software: ${c.software}${c.softwareVersion ? ` ${c.softwareVersion}` : ""}`, c.usualFormat && `Formato: ${c.usualFormat}`].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}\n` : "";
}

/* ---------- Elegir cliente ---------- */

function ClientPicker({ value, onChange, responsables }: { value: ClientInfo | null; onChange: (c: ClientInfo | null) => void; responsables: Option[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchClients>>>([]);
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startTransition(async () => setResults(await searchClients(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (id: string) =>
    startTransition(async () => {
      const c = await getClientForJob(id);
      if (c) onChange(c);
      setQ("");
      setResults([]);
    });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-medium">{value.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {formatWhatsapp(value.whatsapp)}
            {value.university ? ` · ${value.university}` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar cliente" placeholder="Nombre o WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" autoComplete="off" />
        </label>
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          <UserPlus /> Nuevo
        </Button>
      </div>
      {q.trim().length >= 2 && (
        <ul className="divide-y overflow-hidden rounded-md border bg-background animate-in fade-in">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pick(c.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted">
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatWhatsapp(c.whatsapp)}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-2.5 text-sm text-muted-foreground">Sin resultados. Créalo con “Nuevo”.</li>}
        </ul>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>Si el WhatsApp ya existe, se usa el cliente registrado.</DialogDescription>
          </DialogHeader>
          <ClientForm
            compact
            responsables={responsables}
            onSaved={(c) => {
              setCreating(false);
              pick(c.id);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Avisos (RF-35, RF-46) ---------- */

function Warnings({ w }: { w: JobWarnings | null }) {
  if (!w || (!w.sameCourse.length && !w.debts.length)) return null;
  const debtTotal = w.debts.reduce((s, d) => s + d.balance, 0);
  return (
    <div className="grid gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ease-(--ease-out)">
      {w.debts.length > 0 && (
        <div role="status" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-danger">
            <CircleAlert className="size-4" /> Debe {formatMoney(debtTotal)} de trabajos anteriores
          </p>
          <ul className="mt-1.5 grid gap-0.5 pl-6 text-muted-foreground">
            {w.debts.map((d) => (
              <li key={d.id}>
                <Link href={`/trabajos/${d.id}`} target="_blank" className="font-mono text-xs underline-offset-4 hover:underline">
                  {d.code}
                </Link>{" "}
                · saldo {formatMoney(d.balance)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {w.sameCourse.length > 0 && (
        <div role="status" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-warning">
            <CircleAlert className="size-4" />
            {w.sameCourse.some((s) => s.level === "seguro") ? "Hay trabajos del mismo curso" : "Posible coincidencia de curso"}
          </p>
          <p className="mt-1 pl-6 text-muted-foreground">Coordina con el responsable para que cada trabajo salga diferente.</p>
          <ul className="mt-1.5 grid gap-0.5 pl-6 text-muted-foreground">
            {w.sameCourse.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/trabajos/${s.id}`} target="_blank" className="font-mono text-xs underline-offset-4 hover:underline">
                  {s.code}
                </Link>{" "}
                · {s.clientName} · {s.responsable ?? "sin responsable"}
                {s.level === "posible" && <span className="text-xs"> (posible)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Formulario ---------- */

export function JobForm({
  mode,
  jobId,
  code,
  serviceTypes,
  responsables,
  initialClient,
  initialParentId,
  defaults,
  canEditPrice,
}: {
  mode: "crear" | "editar";
  jobId?: string;
  code?: string;
  serviceTypes: ServiceOption[];
  responsables: Option[];
  initialClient?: ClientInfo | null;
  initialParentId?: string;
  defaults?: Partial<JobFormValues>;
  canEditPrice: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [client, setClient] = useState<ClientInfo | null>(initialClient ?? null);
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([]);
  const [warnings, setWarnings] = useState<JobWarnings | null>(null);
  const [repeated, setRepeated] = useState<JobWarnings["repeated"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [, startCheck] = useTransition();

  const { register, handleSubmit, control, setValue, getValues } = useForm<JobFormValues>({
    defaultValues: {
      serviceTypeId: "",
      course: "",
      professor: "",
      section: "",
      academicTerm: "",
      description: initialClient ? preferenceLine(initialClient) : "",
      dueDate: "",
      urgency: "normal",
      price: "",
      responsableId: initialClient?.preferredResponsableId ?? "",
      status: "consulta",
      parentJobId: initialParentId ?? "",
      ...defaults,
    },
  });
  const [serviceTypeId, course, professor, academicTerm, parentJobId, status] = useWatch({
    control,
    name: ["serviceTypeId", "course", "professor", "academicTerm", "parentJobId", "status"],
  });

  // Cliente elegido: sus trabajos (para relacionar) y sus preferencias (RF-38).
  const clientId = client?.id;
  useEffect(() => {
    if (mode !== "crear" || !clientId) return;
    startCheck(async () => setClientJobs(await listClientJobs(clientId)));
  }, [clientId, mode]);

  const chooseClient = (c: ClientInfo | null) => {
    setClient(c);
    setValue("parentJobId", "");
    setWarnings(null);
    if (c && mode === "crear") {
      if (!getValues("description").trim()) setValue("description", preferenceLine(c));
      if (!getValues("responsableId") && c.preferredResponsableId) setValue("responsableId", c.preferredResponsableId);
    }
  };

  // Avisos mientras se escribe (solo al crear, con pausa para no consultar en cada tecla).
  useEffect(() => {
    if (mode !== "crear" || !clientId) return;
    const t = setTimeout(() => {
      startCheck(async () => setWarnings(await checkJobWarnings({ clientId, serviceTypeId, course, professor, academicTerm })));
    }, 500);
    return () => clearTimeout(t);
  }, [mode, clientId, serviceTypeId, course, professor, academicTerm]);

  // RF-39: si eligen un relacionado, se conecta al original.
  const parentNote = useMemo(() => {
    const chosen = clientJobs.find((j) => j.id === parentJobId);
    if (!chosen?.parentJobId) return null;
    const root = clientJobs.find((j) => j.id === chosen.parentJobId);
    return `${chosen.code} ya es relacionado: el nuevo se conectará al original${root ? ` ${root.code}` : ""}.`;
  }, [clientJobs, parentJobId]);

  const save = (values: JobFormValues, confirmedNew = false) => {
    setError(null);
    startTransition(async () => {
      if (mode === "editar") {
        const { status: _s, parentJobId: _p, ...rest } = values;
        void _s;
        void _p;
        const res = await updateJob({ id: jobId!, ...rest, price: canEditPrice ? rest.price : (defaults?.price ?? "") });
        if (!res.ok) {
          setError(res.error);
          setFieldErrors(res.fieldErrors ?? {});
        } else router.push(`/trabajos/${jobId}`);
        return;
      }
      if (!client) {
        setError("Elige un cliente.");
        return;
      }
      const res = await createJob({ ...values, clientId: client.id, confirmedNew });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      if (res.data?.kind === "confirm") {
        setRepeated(res.data.repeated);
        return;
      }
      if (res.data?.kind === "created") {
        const q = res.data.driveWarning ? `?aviso=${encodeURIComponent(res.data.driveWarning)}` : "";
        router.push(`/trabajos/${res.data.id}${q}`);
      }
    });
  };

  const err = (k: string) => fieldErrors[k]?.[0];
  const activeTypes = serviceTypes.filter((t) => t.active || t.id === defaults?.serviceTypeId);
  const activePeople = responsables.filter((r) => r.active || r.id === defaults?.responsableId);

  return (
    <form onSubmit={handleSubmit((v) => save(v))} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {mode === "crear" ? (
              <ClientPicker value={client} onChange={chooseClient} responsables={responsables} />
            ) : (
              <p className="font-medium">{client?.name}</p>
            )}
            {mode === "crear" && client && clientJobs.length > 0 && (
              <Field label="Relacionado con un trabajo anterior" htmlFor="parentJobId" optional hint={parentNote ?? "Algo nuevo que no estaba en el pedido original: tiene su propio precio. Los cambios a lo acordado son correcciones, no un trabajo nuevo."}>
                <NativeSelect id="parentJobId" {...register("parentJobId")}>
                  <option value="">No, es un trabajo independiente</option>
                  {clientJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.course ?? j.description.slice(0, 40)}
                      {j.parentJobId ? " (relacionado)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Warnings w={warnings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trabajo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de servicio" htmlFor="serviceTypeId" error={err("serviceTypeId")} hint={mode === "editar" ? `El código ${code} no cambia aunque cambies el tipo.` : undefined}>
              <NativeSelect id="serviceTypeId" required {...register("serviceTypeId")}>
                <option value="">Elegir…</option>
                {activeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.prefix} · {t.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Curso" htmlFor="course" optional>
              <Input id="course" {...register("course")} />
            </Field>
            <Field label="Profesor" htmlFor="professor" optional>
              <Input id="professor" {...register("professor")} />
            </Field>
            <Field label="Sección" htmlFor="section" optional>
              <Input id="section" {...register("section")} />
            </Field>
            <Field label="Ciclo académico" htmlFor="academicTerm" optional>
              <Input id="academicTerm" placeholder="2026-II" {...register("academicTerm")} />
            </Field>
            <Field label="Qué pide" htmlFor="description" error={err("description")} className="sm:col-span-2">
              <Textarea id="description" rows={4} required {...register("description")} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-6 lg:sticky lg:top-10">
        <Card>
          <CardContent className="grid gap-4">
            {mode === "crear" && (
              <Field label="Estado" htmlFor="status" hint={STATUS_HINTS[status]}>
                <NativeSelect id="status" {...register("status")}>
                  {JOB_STATUSES.filter((s) => s !== "cancelado").map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Fecha de entrega" htmlFor="dueDate" optional error={err("dueDate")} hint="El día en que el cliente quiere recibirlo">
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </Field>
            <Field label="Urgencia" htmlFor="urgency">
              <NativeSelect id="urgency" {...register("urgency")}>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABELS[u]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Precio (S/)"
              htmlFor="price"
              optional
              error={err("price")}
              hint={canEditPrice ? (mode === "crear" ? "Vacío mientras sea una consulta" : undefined) : "Solo el admin puede cambiar el precio o dar descuentos."}
            >
              <Input id="price" inputMode="decimal" placeholder="0.00" disabled={!canEditPrice} className="tabular-nums" {...register("price")} />
            </Field>
            <Field label="Responsable" htmlFor="responsableId" optional>
              <NativeSelect id="responsableId" {...register("responsableId")}>
                <option value="">Sin asignar</option>
                {activePeople.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <FormError message={error} />
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Guardando…" : mode === "crear" ? "Crear trabajo" : "Guardar cambios"}
            </Button>
            <Link href="/carga" target="_blank" className="text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              <Link2 className="mr-1 inline size-3" />
              Ver la carga de cada responsable
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* RF-37 */}
      <Dialog open={!!repeated} onOpenChange={(o) => !o && setRepeated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pedido nuevo o el mismo?</DialogTitle>
            <DialogDescription>
              Este cliente ya tiene abierto {repeated?.map((r) => r.code).join(", ")}
              {repeated?.[0] ? ` (${repeated[0].course ?? repeated[0].serviceType})` : ""}. ¿Es un pedido nuevo o es el mismo?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {repeated?.map((r) => (
              <Button key={r.id} type="button" variant="outline" onClick={() => router.push(`/trabajos/${r.id}`)}>
                Es el mismo: ir a {r.code}
              </Button>
            ))}
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setRepeated(null);
                save(getValues(), true);
              }}
            >
              Es nuevo: crearlo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

