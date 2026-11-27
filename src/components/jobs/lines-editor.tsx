"use client";

import { X } from "lucide-react";
import type { TarifaItem } from "@/lib/queries/catalog";
import { round2 } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/field";
import { ItemPicker } from "@/components/jobs/item-picker";

export type Line = {
  key: string;
  serviceItemId: string;
  code: string;
  name: string;
  unit: string;
  pricingMode: "fijo" | "ciclo";
  /** Precio base (personalizado: el acordado). */
  basePrice: number;
  /** Factor congelado del ítem ya registrado; si falta, se usa el del ciclo actual. */
  frozenFactor?: number;
  unitHours: number;
  quantity: number;
  isCustom: boolean;
  detail?: string;
  jobItemId?: string;
  done?: boolean;
};

export function lineFromItem(t: TarifaItem): Line {
  return {
    key: crypto.randomUUID(),
    serviceItemId: t.id,
    code: t.code,
    name: t.name,
    unit: t.unit,
    pricingMode: t.isCustom ? "fijo" : t.pricingMode,
    basePrice: t.isCustom ? 0 : t.basePrice,
    unitHours: t.hours ?? 0,
    quantity: 1,
    isCustom: t.isCustom,
    detail: "",
  };
}

export function lineFactor(l: Line, factor: number) {
  if (l.frozenFactor !== undefined) return l.frozenFactor;
  return l.pricingMode === "ciclo" ? factor : 1;
}

export function lineTotal(l: Line, factor: number) {
  return round2(l.basePrice * l.quantity * lineFactor(l, factor));
}

/** 03 · Lo que se cobra (RF-59, RF-68). */
export function LinesEditor({
  lines,
  setLines,
  tarifario,
  factor,
  cycle,
  error,
}: {
  lines: Line[];
  setLines: (fn: (prev: Line[]) => Line[]) => void;
  tarifario: TarifaItem[];
  factor: number;
  cycle: number | null;
  error?: string;
}) {
  const inJob = new Map<string, number>();
  for (const l of lines) inJob.set(l.serviceItemId, (inJob.get(l.serviceItemId) ?? 0) + l.quantity);
  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-2">
      {lines.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-surface">
          {lines.map((l, i) =>
            l.isCustom ? (
              <div key={l.key} className={cn("enter flex flex-col gap-2.5 px-3 py-3", i > 0 && "border-t border-line")}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted">OT-01</span>
                  <span className="text-[13px] font-medium">Personalizado</span>
                  <span className="text-[12px] text-faint">· no está en el tarifario</span>
                  {!l.done && (
                    <button type="button" aria-label="Quitar ítem" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="press ml-auto grid size-7 place-items-center rounded text-muted hover-fine:hover:text-fg">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] text-muted">Qué es · obligatorio</span>
                  <Textarea value={l.detail ?? ""} onChange={(e) => update(l.key, { detail: e.target.value })} placeholder="Con todo el detalle: material, escala, tamaño, qué incluye…" className="min-h-16" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted">Cantidad</span>
                    <Stepper label="Cantidad" value={l.quantity} min={1} onChange={(v) => update(l.key, { quantity: v })} size="sm" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted">Horas estimadas · opcional</span>
                    <Stepper label="Horas estimadas" value={l.unitHours} min={0} step={0.5} suffix="h" onChange={(v) => update(l.key, { unitHours: v })} size="sm" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[11px] text-muted">Precio acordado con el admin</span>
                    <Stepper label="Precio acordado" value={l.basePrice} min={0} step={5} prefix="S/" decimals={2} onChange={(v) => update(l.key, { basePrice: v })} size="sm" />
                  </label>
                </div>
                <p className="text-xs text-faint">Sin factor por ciclo. El recargo por urgencia se suma en el total.</p>
              </div>
            ) : (
              <div key={l.key} className={cn("enter grid grid-cols-[52px_minmax(0,1fr)_112px_76px_28px] items-center gap-2.5 px-3 py-2", i > 0 && "border-t border-line")}>
                <span className="font-mono text-[11px] text-muted">{l.code}</span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13.5px]", l.done && "text-faint line-through")}>{l.name}</span>
                  <span className="block truncate text-[11.5px] text-faint">
                    S/ {l.basePrice} {l.unit}
                    {lineFactor(l, factor) !== 1 && ` · ×${lineFactor(l, factor).toFixed(2)}`}
                  </span>
                </span>
                <Stepper label={`Cantidad de ${l.code}`} value={l.quantity} min={1} onChange={(v) => update(l.key, { quantity: v })} size="sm" />
                <span className="text-right font-mono text-[13px]">{lineTotal(l, factor).toFixed(2)}</span>
                {l.done ? (
                  <span className="text-center font-mono text-[10px] text-faint" title="Ya está hecho">✓</span>
                ) : (
                  <button type="button" aria-label={`Quitar ${l.code}`} onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="press grid size-7 place-items-center rounded text-muted hover-fine:hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
      <ItemPicker
        tarifario={tarifario}
        factor={factor}
        cycle={cycle}
        inJob={inJob}
        onPick={(t) =>
          setLines((prev) => {
            const same = !t.isCustom && prev.find((l) => l.serviceItemId === t.id && !l.jobItemId);
            if (same) return prev.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
            return [...prev, lineFromItem(t)];
          })
        }
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
