"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { findClientByPhone, searchClients, type ClientHit } from "@/actions/jobs";
import { formatPhone, initials } from "@/lib/domain";
import { cn, formatMoney } from "@/lib/utils";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";

export type NewClient = { name: string; whatsapp: string; university: string; career: string; cycle: number | null };

/** Tarjeta del cliente elegido. */
export function ClientCard({ c, onChange }: { c: ClientHit; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-line text-[11px] font-semibold">{initials(c.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{c.name}</span>
        <span className="block truncate text-xs text-muted">
          {formatPhone(c.whatsapp)} · {[c.university, c.career].filter(Boolean).join(" · ") || "sin universidad"}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-muted">
        {c.jobs} {c.jobs === 1 ? "trabajo" : "trabajos"}
        {c.debt > 0 && <span className="block text-warning">debe {formatMoney(c.debt)}</span>}
      </span>
      {onChange && (
        <button type="button" onClick={onChange} className="press shrink-0 text-xs text-info underline-offset-4 hover-fine:hover:underline">
          Cambiar
        </button>
      )}
    </div>
  );
}

/**
 * Buscar cliente por nombre o celular (RF-06) o registrarlo ahí mismo
 * empezando por su WhatsApp; si el número ya existe se ofrece usarlo (RF-36).
 */
export function ClientPicker({
  onPick,
  newClient,
  setNewClient,
  error,
}: {
  onPick: (c: ClientHit) => void;
  newClient: NewClient | null;
  setNewClient: (c: NewClient | null) => void;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [hi, setHi] = useState(0);
  const [found, setDupe] = useState<ClientHit | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (newClient) return;
    const t = setTimeout(() => {
      if (q.trim().length < 2) return setHits([]);
      start(async () => setHits(await searchClients(q)));
    }, 180);
    return () => clearTimeout(t);
  }, [q, newClient]);

  const phone = newClient?.whatsapp.replace(/\D/g, "") ?? "";
  useEffect(() => {
    if (!newClient || phone.length < 9) return;
    start(async () => setDupe(await findClientByPhone(phone)));
  }, [phone, newClient]);
  const dupe = newClient && phone.length >= 9 ? found : null;

  if (newClient)
    return (
      <div className="enter flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Celular (WhatsApp)" aside={<span className="font-mono text-[11px] text-faint">obligatorio</span>} error={error}>
            <div className="flex h-10 items-center rounded-md border bg-surface focus-within:border-muted">
              <span className="pl-3 font-mono text-[13px] text-faint">+51</span>
              <input
                autoFocus
                inputMode="tel"
                value={newClient.whatsapp}
                onChange={(e) => setNewClient({ ...newClient, whatsapp: e.target.value })}
                placeholder="987 654 321"
                aria-label="Celular"
                className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm outline-none"
              />
            </div>
          </Field>
          <Field label="Nombre">
            <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nombre y apellido" />
          </Field>
        </div>
        {dupe && (
          <div className="enter flex items-center gap-3 rounded-lg border border-warning-line bg-warning-soft px-3 py-2.5">
            <span className="size-2 shrink-0 rounded-full bg-warning" />
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="font-medium">Este número ya es de {dupe.name}</b>
              <span className="block text-xs text-muted">
                {[dupe.university, dupe.career].filter(Boolean).join(" · ")} · {dupe.jobs} trabajos. No se crea un cliente repetido.
              </span>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewClient(null);
                onPick(dupe);
              }}
            >
              Usar a {dupe.name.split(" ")[0]}
            </Button>
          </div>
        )}
        <div className={cn("grid gap-3 transition-opacity duration-150 sm:grid-cols-3", dupe && "pointer-events-none opacity-40")}>
          <Field label="Universidad" optional>
            <Input value={newClient.university} onChange={(e) => setNewClient({ ...newClient, university: e.target.value })} placeholder="UNI" />
          </Field>
          <Field label="Carrera" optional>
            <Input value={newClient.career} onChange={(e) => setNewClient({ ...newClient, career: e.target.value })} placeholder="Arquitectura" />
          </Field>
          <Field label="Ciclo" optional>
            <Stepper label="Ciclo" value={newClient.cycle ?? 0} min={0} max={10} onChange={(v) => setNewClient({ ...newClient, cycle: v || null })} />
          </Field>
        </div>
        <button type="button" onClick={() => setNewClient(null)} className="self-start text-xs text-muted underline-offset-4 hover-fine:hover:underline">
          Buscar un cliente registrado
        </button>
      </div>
    );

  const options = hits.length;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex h-10 items-center gap-2 rounded-md border bg-surface px-3 focus-within:border-muted">
        <Search className="size-4 text-muted" />
        <input
          ref={input}
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(options, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (hi < options && hits[hi]) onPick(hits[hi]);
              else if (q.trim()) startNew();
            }
          }}
          placeholder="Nombre o celular"
          aria-label="Buscar cliente"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      {q.trim().length >= 2 && (
        <div role="listbox" aria-label="Clientes registrados" className="enter overflow-hidden rounded-lg border bg-surface">
          {hits.length > 0 && <p className="px-3 pt-2 pb-1 font-mono text-[10.5px] tracking-wide text-faint">CLIENTES REGISTRADOS</p>}
          {hits.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={hi === i}
              onMouseEnter={() => setHi(i)}
              onClick={() => onPick(c)}
              className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", hi === i && "bg-hover")}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-line text-[10.5px] font-semibold">{initials(c.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">{c.name}</span>
                <span className="block truncate text-xs text-muted">
                  {formatPhone(c.whatsapp)} · {[c.university, c.career].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs", c.debt > 0 ? "text-warning" : "text-muted")}>
                {c.jobs} {c.jobs === 1 ? "trabajo" : "trabajos"}
                {c.debt > 0 && ` · debe ${formatMoney(c.debt)}`}
              </span>
            </button>
          ))}
          <button
            type="button"
            onMouseEnter={() => setHi(options)}
            onClick={startNew}
            className={cn("flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-[13px] text-info", hi === options && "bg-hover")}
          >
            <UserPlus className="size-4" />
            Registrar «{q.trim()}» como cliente nuevo
            <span className="ml-auto font-mono text-[10.5px] text-faint">↑↓ para moverte · Enter para elegir</span>
          </button>
        </div>
      )}
    </div>
  );

  function startNew() {
    const t = q.trim();
    const digits = t.replace(/\D/g, "");
    setNewClient({ name: digits.length >= 6 ? "" : t, whatsapp: digits.length >= 6 ? digits : "", university: "", career: "", cycle: null });
  }
}
