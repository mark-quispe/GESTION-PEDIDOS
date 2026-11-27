"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import type { TarifaItem } from "@/lib/queries/catalog";
import { lineAmount, normalizeText } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/jobs/bits";

/**
 * Agregar ítem (RF-59): buscador por código o nombre con el precio ya calculado
 * con el ciclo. Avisa si ya está en el trabajo. ↑↓ para elegir, Enter agrega 1.
 * Personalizado siempre al final (RF-68).
 */
export function ItemPicker({
  tarifario,
  factor,
  cycle,
  inJob,
  onPick,
}: {
  tarifario: TarifaItem[];
  factor: number;
  cycle: number | null;
  inJob: Map<string, number>;
  onPick: (item: TarifaItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const custom = tarifario.find((t) => t.isCustom);
  const results = useMemo(() => {
    const term = normalizeText(q);
    const base = tarifario.filter((t) => !t.isCustom);
    if (!term) return base.slice(0, 60);
    // Primero lo que coincide en código o nombre; después, por la categoría.
    const score = (t: TarifaItem) => {
      const code = normalizeText(t.code);
      const name = normalizeText(t.name);
      if (code.startsWith(term)) return 0;
      if (name.startsWith(term)) return 1;
      if (name.includes(term)) return 2;
      if (normalizeText(t.categoryName).includes(term) || normalizeText(t.includes ?? "").includes(term)) return 3;
      return 9;
    };
    return base
      .map((t) => ({ t, s: score(t) }))
      .filter((x) => x.s < 9)
      .sort((a, b) => a.s - b.s)
      .map((x) => x.t)
      .slice(0, 40);
  }, [q, tarifario]);
  const all = custom ? [...results, custom] : results;

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  // Se queda la búsqueda: otro Enter suma una unidad más del mismo ítem.
  const pick = (t: TarifaItem) => {
    onPick(t);
    input.current?.select();
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex h-10 w-full items-center gap-2 rounded-md border border-dashed border-border-strong px-3 text-[13px] text-muted hover-fine:hover:border-muted hover-fine:hover:text-fg"
      >
        <Plus className="size-4" />
        Agregar ítem
        <span className="text-faint">· código o nombre del tarifario</span>
      </button>
    );

  return (
    <div className="modal overflow-hidden rounded-lg border bg-bg" data-state="open" data-esc-local>
      <label className="flex h-10 items-center gap-2 border-b px-3">
        <Search className="size-4 text-muted" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(all.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (all[hi]) pick(all[hi]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
          placeholder="Código o nombre (plan, PL-06, render…)"
          aria-label="Buscar en el tarifario"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <button type="button" onClick={() => setOpen(false)} className="font-mono text-[11px] text-faint">
          esc
        </button>
      </label>
      <p className="px-3 pt-2 pb-1 font-mono text-[11px] text-faint">
        {q ? `«${q}» · ${results.length} ítems` : "Tarifario"}
      </p>
      <div ref={listRef} role="listbox" aria-label="Ítems del tarifario" className="scroll-thin max-h-64 overflow-y-auto pb-1">
        {all.map((t, i) => {
          const n = inJob.get(t.id) ?? 0;
          const active = i === hi;
          if (t.isCustom)
            return (
              <button
                key={t.id}
                type="button"
                data-i={i}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(t)}
                className={cn("mx-2 my-1 flex w-[calc(100%-16px)] items-center gap-3 rounded-md border border-dashed px-3 py-2 text-left", active ? "border-muted bg-hover" : "border-border-strong")}
              >
                <span className="font-mono text-[11px] text-muted">OT-01</span>
                <Sparkles className="size-3.5 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px]">
                    Personalizado <span className="text-faint">· no está en el tarifario</span>
                  </span>
                  <span className="block truncate text-[11.5px] text-faint">Describes qué pide y escribes el precio acordado con el admin</span>
                </span>
                <span className="font-mono text-[11px] text-faint">precio a mano</span>
              </button>
            );
          return (
            <button
              key={t.id}
              type="button"
              data-i={i}
              role="option"
              aria-selected={active}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(t)}
              className={cn("grid w-full grid-cols-[52px_minmax(0,1fr)_38px_92px_70px] items-center gap-2 px-3 py-[7px] text-left", active && "bg-hover")}
            >
              <span className="font-mono text-[11px] text-muted">{t.code}</span>
              <span className="truncate text-[13px]">
                {t.name}
                {n > 0 && <span className="text-faint"> · ya está ×{n}</span>}
              </span>
              <span className="font-mono text-[10.5px] text-faint">{t.pricingMode === "ciclo" ? "×C" : "FIJO"}</span>
              <span className="truncate text-[11.5px] text-faint">{t.unit}</span>
              <span className="text-right font-mono text-[12.5px]">
                {lineAmount({ basePrice: t.basePrice, quantity: 1, pricingMode: t.pricingMode }, factor).toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-3 border-t px-3 py-1.5 font-mono text-[10.5px] text-faint">
        <span>↑↓ elegir</span>
        <span>
          <Kbd>enter</Kbd> agrega 1
        </span>
        <span className="ml-auto">{cycle ? `precio ya con el ciclo ${cycle}` : "elige el ciclo para ver el precio con su factor"}</span>
      </p>
    </div>
  );
}
