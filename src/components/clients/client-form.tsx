"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, lookupWhatsapp, updateClient } from "@/actions/clients";
import type { ClientInput } from "@/lib/validation/clients";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

type Existing = { id: string; name: string; deleted: boolean };

const SOURCES = ["Recomendación", "Instagram", "Facebook", "TikTok", "WhatsApp", "Volvió a pedir", "Otro"];

export function ClientForm({
  initial,
  clientId,
  responsables,
  onSaved,
  compact,
}: {
  initial?: Partial<Record<keyof ClientInput, string | null>>;
  clientId?: string;
  responsables: { id: string; name: string; active: boolean }[];
  /** En el formulario de trabajo: devuelve el cliente en vez de navegar. */
  onSaved?: (client: { id: string; name: string }) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [existing, setExisting] = useState<Existing | null>(null);
  const v = (k: keyof ClientInput) => initial?.[k] ?? "";

  // RF-36: avisa en cuanto se escribe un número que ya existe.
  const checkWhatsapp = (raw: string) => {
    if (clientId) return;
    startTransition(async () => setExisting(await lookupWhatsapp(raw)));
  };

  const submit = (form: FormData) => {
    setError(null);
    const input = Object.fromEntries([...form.entries()].map(([k, val]) => [k, String(val)])) as unknown as ClientInput;
    startTransition(async () => {
      const res = clientId ? await updateClient(clientId, input) : await createClient(input);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      const id = res.data!.id;
      const name = res.data!.existing?.name ?? input.name;
      if (onSaved) onSaved({ id, name });
      else router.push(`/clientes/${id}`);
    });
  };

  const err = (k: string) => fieldErrors[k]?.[0];

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        // stopPropagation: dentro del diálogo del trabajo, el evento no debe llegar al formulario de afuera.
        e.preventDefault();
        e.stopPropagation();
        submit(new FormData(e.currentTarget));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input id="name" name="name" required defaultValue={v("name")} autoComplete="off" />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" error={err("whatsapp")} hint="Con o sin +51. No puede repetirse.">
          <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" required defaultValue={v("whatsapp")} onBlur={(e) => checkWhatsapp(e.target.value)} />
        </Field>
        <Field label="Cómo llegó" htmlFor="source" optional>
          <Input id="source" name="source" list="sources" defaultValue={v("source")} />
          <datalist id="sources">
            {SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        {existing && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning sm:col-span-2 animate-in fade-in">
            Este número ya es de <strong className="font-medium">{existing.name}</strong>
            {existing.deleted ? " (eliminado: el admin puede restaurarlo)" : ""}. Al guardar se usará ese cliente, no se crea otro.
            {!onSaved && !existing.deleted && (
              <>
                {" "}
                <Link href={`/clientes/${existing.id}`} className="underline underline-offset-4">
                  Ver su ficha
                </Link>
              </>
            )}
          </div>
        )}
        <Field label="Universidad" htmlFor="university" optional>
          <Input id="university" name="university" defaultValue={v("university")} />
        </Field>
        <Field label="Carrera" htmlFor="career" optional>
          <Input id="career" name="career" defaultValue={v("career")} />
        </Field>
        <Field label="Ciclo" htmlFor="cycle" optional hint="Ciclo que cursa, por ejemplo 7">
          <Input id="cycle" name="cycle" defaultValue={v("cycle")} />
        </Field>
      </div>

      {!compact && (
        <fieldset className="grid gap-4 border-t pt-6 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">
            Preferencias <span className="font-normal text-muted-foreground">· se copian al crear un trabajo nuevo</span>
          </legend>
          <Field label="Software" htmlFor="software" optional>
            <Input id="software" name="software" placeholder="AutoCAD, Revit, SketchUp…" defaultValue={v("software")} />
          </Field>
          <Field label="Versión" htmlFor="softwareVersion" optional>
            <Input id="softwareVersion" name="softwareVersion" placeholder="2024" defaultValue={v("softwareVersion")} />
          </Field>
          <Field label="Formato habitual" htmlFor="usualFormat" optional>
            <Input id="usualFormat" name="usualFormat" placeholder="A1, láminas en PDF…" defaultValue={v("usualFormat")} />
          </Field>
          <Field label="Suele trabajar con" htmlFor="preferredResponsableId" optional>
            <NativeSelect id="preferredResponsableId" name="preferredResponsableId" defaultValue={v("preferredResponsableId")}>
              <option value="">Sin preferencia</option>
              {responsables
                .filter((r) => r.active || r.id === v("preferredResponsableId"))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Observaciones" htmlFor="observations" optional className="sm:col-span-2" hint="Visible para todo el equipo: “paga tarde”, “pide muchas correcciones”…">
            <Textarea id="observations" name="observations" rows={3} defaultValue={v("observations")} />
          </Field>
        </fieldset>
      )}

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : existing && !clientId ? `Usar a ${existing.name}` : clientId ? "Guardar cambios" : "Guardar cliente"}
        </Button>
      </div>
    </form>
  );
}
