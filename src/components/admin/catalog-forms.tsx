"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { saveCodeStart, saveResponsable, saveServiceType, toggleResponsable, toggleServiceType } from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Result = { ok: boolean; error?: string };

function InlineForm({
  fields,
  initial,
  onSave,
  submitLabel,
  onDone,
}: {
  fields: { name: string; label: string; placeholder?: string; className?: string; maxLength?: number }[];
  initial?: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<Result>;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const values = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
        startTransition(async () => {
          const res = await onSave(values);
          if (!res.ok) return setError(res.error ?? "No se pudo guardar.");
          setError(null);
          if (!initial) form.reset();
          onDone?.();
        });
      }}
    >
      <div className="flex flex-wrap items-start gap-2">
        {fields.map((f) => (
          <Input key={f.name} name={f.name} aria-label={f.label} placeholder={f.placeholder ?? f.label} defaultValue={initial?.[f.name] ?? ""} maxLength={f.maxLength} className={f.className ?? "max-w-xs"} />
        ))}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
      </div>
      <FormError message={error} />
    </form>
  );
}

function ToggleActive({ active, onToggle }: { active: boolean; onToggle: (v: boolean) => Promise<Result> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await onToggle(!active)))}>
      {active ? "Desactivar" : "Activar"}
    </Button>
  );
}

export function ServiceTypesManager({ rows }: { rows: { id: string; name: string; prefix: string; active: boolean; jobs: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const fields = [
    { name: "prefix", label: "Prefijo", placeholder: "PL", className: "w-20 uppercase font-mono", maxLength: 2 },
    { name: "name", label: "Nombre", placeholder: "Planos" },
  ];
  return (
    <div className="grid gap-6">
      <InlineForm fields={fields} onSave={(v) => saveServiceType(v as { name: string; prefix: string })} submitLabel="Agregar tipo" />
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {editing === t.id ? (
              <div className="flex-1">
                <InlineForm fields={fields} initial={{ name: t.name, prefix: t.prefix }} onSave={(v) => saveServiceType({ ...(v as { name: string; prefix: string }), id: t.id })} submitLabel="Guardar" onDone={() => setEditing(null)} />
                <p className="mt-2 text-xs text-muted-foreground">Los códigos ya creados no cambian: el nuevo prefijo solo vale para los trabajos nuevos.</p>
              </div>
            ) : (
              <>
                <span className="w-10 font-mono text-sm font-medium">{t.prefix}</span>
                <span className="flex-1">{t.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{t.jobs} trabajos</span>
                {!t.active && <Badge variant="muted">Inactivo</Badge>}
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(t.id)}>
                  <Pencil /> Editar
                </Button>
                <ToggleActive active={t.active} onToggle={(v) => toggleServiceType(t.id, v)} />
              </>
            )}
          </li>
        ))}
        {!rows.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Agrega los tipos de servicio con su prefijo de dos letras (PL, RD, MQ…).</li>}
      </ul>
    </div>
  );
}

export function ResponsablesManager({ rows }: { rows: { id: string; name: string; contact: string | null; active: boolean; open: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const fields = [
    { name: "name", label: "Nombre" },
    { name: "contact", label: "Contacto", placeholder: "WhatsApp o correo (opcional)" },
  ];
  return (
    <div className="grid gap-6">
      <InlineForm fields={fields} onSave={(v) => saveResponsable(v as { name: string; contact: string })} submitLabel="Agregar" />
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {editing === r.id ? (
              <div className="flex-1">
                <InlineForm fields={fields} initial={{ name: r.name, contact: r.contact ?? "" }} onSave={(v) => saveResponsable({ ...(v as { name: string; contact: string }), id: r.id })} submitLabel="Guardar" onDone={() => setEditing(null)} />
              </div>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">{r.contact ?? "Sin contacto"}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{r.open} en curso</span>
                {!r.active && <Badge variant="muted">Inactivo</Badge>}
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(r.id)}>
                  <Pencil /> Editar
                </Button>
                <ToggleActive active={r.active} onToggle={(v) => toggleResponsable(r.id, v)} />
              </>
            )}
          </li>
        ))}
        {!rows.length && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Agrega a las personas que hacen los trabajos. No necesitan cuenta.</li>}
      </ul>
    </div>
  );
}

export function CodeStartForm({ value }: { value: number }) {
  return <InlineForm fields={[{ name: "codeStart", label: "Empieza en", className: "w-28 tabular-nums" }]} initial={{ codeStart: String(value) }} onSave={(v) => saveCodeStart(v as { codeStart: string })} submitLabel="Guardar" />;
}
