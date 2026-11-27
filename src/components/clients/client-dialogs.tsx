"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { addObservation, saveClient, savePreferences } from "@/actions/clients";
import { cn } from "@/lib/utils";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Choice } from "@/components/ui/choice";
import { Stepper } from "@/components/ui/stepper";

type ClientData = { id: string; name: string; whatsapp: string; university: string | null; career: string | null; cycle: number | null; source: string | null };

const SOURCES = ["Recomendación", "Instagram", "Facebook", "TikTok", "WhatsApp", "Otro"];

/** RF-05: registrar o editar al cliente. Si el WhatsApp ya existe, se abre ese cliente (RF-36). */
export function ClientFormDialog({ open, onOpenChange, client }: { open: boolean; onOpenChange: (v: boolean) => void; client?: ClientData }) {
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <ClientForm client={client} close={() => onOpenChange(false)} />}</DialogRoot>;
}

function ClientForm({ client, close }: { client?: ClientData; close: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    name: client?.name ?? "",
    whatsapp: client?.whatsapp ?? "",
    university: client?.university ?? "",
    career: client?.career ?? "",
    cycle: client?.cycle ?? null,
    source: client?.source ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const save = () =>
    start(async () => {
      const r = await saveClient({ ...v, id: client?.id, university: v.university || undefined, career: v.career || undefined, source: v.source || undefined });
      if (!r.ok) {
        setErrors(Object.fromEntries(Object.entries(r.fieldErrors ?? {}).map(([k, e]) => [k, e?.[0]])));
        return void toast.error(r.error);
      }
      if (r.data?.existing) toast.message("Ese WhatsApp ya estaba registrado: te llevo a ese cliente.");
      else toast.success(client ? "Datos guardados." : "Cliente registrado.");
      close();
      router.push(`/clientes/${r.data!.id}`);
      router.refresh();
    });
  return (
    <DialogContent
      title={client ? "Editar cliente" : "Nuevo cliente"}
      description="Se empieza por su celular: si ya existe, no se crea otro."
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancelar
          </Button>
          <Button size="md" variant="primary" onClick={save} disabled={pending}>
            {client ? "Guardar" : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Celular (WhatsApp)" error={errors.whatsapp}>
          <div className="flex h-10 items-center rounded-md border bg-surface focus-within:border-muted">
            <span className="pl-3 font-mono text-[13px] text-faint">+51</span>
            <input autoFocus inputMode="tel" aria-label="Celular" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} placeholder="987 654 321" className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm outline-none" />
          </div>
        </Field>
        <Field label="Nombre" error={errors.name}>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Nombre y apellido" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Universidad" optional>
            <Input value={v.university} onChange={(e) => setV({ ...v, university: e.target.value })} placeholder="UNI" />
          </Field>
          <Field label="Carrera" optional>
            <Input value={v.career} onChange={(e) => setV({ ...v, career: e.target.value })} placeholder="Arquitectura" />
          </Field>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Ciclo" optional>
            <Stepper label="Ciclo" value={v.cycle ?? 0} min={0} max={10} onChange={(n) => setV({ ...v, cycle: n || null })} />
          </Field>
          <Field label="Cómo llegó" optional>
            <select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} aria-label="Cómo llegó" className="h-10 rounded-md border bg-surface px-3 text-sm">
              <option value="">—</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </DialogContent>
  );
}

/* ---------- Preferencias (RF-38) ---------- */

type Prefs = { id: string; name: string; subtitle: string; software: string | null; usualFormat: string | null; requestedFiles: string | null; otherPrefs: string | null; usualPerson: string | null };

const SOFTWARE_HINTS = ["AutoCAD", "Revit", "SketchUp", "ArchiCAD", "Lumion", "3ds Max", "Photoshop"];
const FILES = ["PDF", "DWG", "RVT", "SKP", "Imagen"];

export function PreferencesDialog({ open, onOpenChange, prefs, isAdmin }: { open: boolean; onOpenChange: (v: boolean) => void; prefs: Prefs; isAdmin: boolean }) {
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <PrefsForm prefs={prefs} close={() => onOpenChange(false)} isAdmin={isAdmin} />}</DialogRoot>;
}

function PrefsForm({ prefs, close, isAdmin }: { prefs: Prefs; close: () => void; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [soft, setSoft] = useState<string[]>(prefs.software ? prefs.software.split(" · ").filter(Boolean) : []);
  const [adding, setAdding] = useState("");
  const [format, setFormat] = useState(prefs.usualFormat ?? "");
  const [files, setFiles] = useState<string[]>(prefs.requestedFiles ? prefs.requestedFiles.split(", ").filter(Boolean) : []);
  const [other, setOther] = useState(prefs.otherPrefs ?? "");
  const addSoft = (s: string) => {
    const t = s.trim();
    if (t && !soft.includes(t)) setSoft([...soft, t]);
    setAdding("");
  };
  const save = () =>
    start(async () => {
      const r = await savePreferences({ clientId: prefs.id, software: soft.join(" · ") || undefined, usualFormat: format || undefined, requestedFiles: files.join(", ") || undefined, otherPrefs: other || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Preferencias guardadas.");
      close();
      router.refresh();
    });
  return (
    <DialogContent
      title="Editar preferencias"
      description={prefs.subtitle}
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancelar
          </Button>
          <Button size="md" variant="primary" onClick={save} disabled={pending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Software que usa">
          <div className="flex flex-wrap gap-1.5">
            {soft.map((s) => (
              <span key={s} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-surface pr-1.5 pl-2.5 text-[13px]">
                {s}
                <button type="button" aria-label={`Quitar ${s}`} onClick={() => setSoft(soft.filter((x) => x !== s))} className="text-faint hover-fine:hover:text-fg">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSoft(adding);
                }
              }}
              placeholder="+ Agregar (Enter)"
              aria-label="Agregar software"
              className="h-8 w-40 rounded-md border border-dashed bg-transparent px-2.5 text-[13px] outline-none focus:border-muted"
            />
          </div>
          <p className="text-xs text-faint">
            Sugerencias:{" "}
            {SOFTWARE_HINTS.filter((h) => !soft.some((s) => s.startsWith(h))).map((h, i) => (
              <button key={h} type="button" onClick={() => addSoft(h)} className="text-muted hover-fine:hover:text-fg">
                {i > 0 && " · "}
                {h}
              </button>
            ))}
          </p>
        </Field>
        <Field label="Formato de entrega">
          <Input value={format} onChange={(e) => setFormat(e.target.value)} placeholder="A1 con rotulado UNI" />
        </Field>
        <Field label="Archivos que pide · varios">
          <div className="flex flex-wrap gap-1.5">
            {FILES.map((f) => {
              const on = files.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFiles(on ? files.filter((x) => x !== f) : [...files, f])}
                  className={cn("press inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors duration-150", on ? "border-fg bg-hover" : "text-muted")}
                >
                  {on && <Check className="size-3.5" />}
                  {f}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Otras preferencias" optional>
          <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Le gustan las láminas con fondo blanco y letra Arial." className="min-h-16" />
        </Field>
        {isAdmin && (
          <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2.5 text-[13px]">
            <span className="text-muted">
              Responsable habitual <span className="text-faint">· se calcula solo · solo admin</span>
            </span>
            <span>{prefs.usualPerson ?? "—"}</span>
          </div>
        )}
        <p className="text-xs text-faint">Se llenan solas en cada trabajo nuevo de {prefs.name.split(" ")[0]}; ahí se pueden cambiar para ese trabajo.</p>
      </div>
    </DialogContent>
  );
}

/* ---------- Observación (RF-45) ---------- */

type Kind = "pagos" | "trato" | "entregas" | "archivos" | "otro";

export function ObservationDialog({ open, onOpenChange, clientId, title }: { open: boolean; onOpenChange: (v: boolean) => void; clientId: string; title: string }) {
  return <DialogRoot open={open} onOpenChange={onOpenChange}>{open && <ObsForm clientId={clientId} title={title} close={() => onOpenChange(false)} />}</DialogRoot>;
}

function ObsForm({ clientId, title, close }: { clientId: string; title: string; close: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [alert, setAlert] = useState(false);
  const save = () =>
    start(async () => {
      const r = await addObservation({ clientId, body, kind, alertOnNewJob: alert });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Observación agregada.");
      close();
      router.refresh();
    });
  return (
    <DialogContent
      title="Agregar observación"
      description={title}
      footer={
        <>
          <Button size="md" onClick={close}>
            Cancelar
          </Button>
          <Button size="md" variant="primary" onClick={save} disabled={pending || body.trim().length < 3}>
            Agregar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Observación">
          <Textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} placeholder="Paga en dos partes y siempre cumple con lo pendiente." className="min-h-16" />
        </Field>
        <Field label="Tipo" optional>
          <Choice
            label="Tipo"
            value={kind}
            onChange={(k) => setKind(k === kind ? null : k)}
            options={[
              { value: "pagos", label: "Pagos" },
              { value: "trato", label: "Trato" },
              { value: "entregas", label: "Entregas" },
              { value: "archivos", label: "Archivos" },
              { value: "otro", label: "Otro" },
            ]}
            size="sm"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 text-[13px]">
          <input type="checkbox" checked={alert} onChange={(e) => setAlert(e.target.checked)} className="size-4 accent-[var(--fg)]" />
          Avisar al crear un trabajo nuevo de este cliente
        </label>
        <p className="text-xs text-faint">Se guarda con tu nombre y la fecha. Quién la escribió solo lo ve el admin.</p>
      </div>
    </DialogContent>
  );
}
