"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Casilla con flechas: se escribe o se sube y baja de `step` en `step`
 * (cantidades de 1 en 1, precios de S/ 5 en S/ 5, montos de S/ 1). Teclado: ↑ ↓.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999_999,
  prefix,
  suffix,
  decimals = 0,
  className,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  label: string;
  size?: "sm" | "md";
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <div className={cn("flex items-center rounded-md border bg-surface focus-within:border-muted", size === "sm" ? "h-8" : "h-10", className)}>
      {prefix && <span className="pl-2.5 font-mono text-xs whitespace-nowrap text-faint">{prefix}</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        value={Number.isFinite(value) ? (decimals ? value.toFixed(decimals) : String(value)) : ""}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""));
          onChange(Number.isFinite(n) ? clamp(n) : min);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(value + step));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value - step));
          }
        }}
        className="w-full min-w-0 bg-transparent px-2 text-right font-mono text-sm outline-none"
      />
      {suffix && <span className="pr-1 font-mono text-xs text-faint">{suffix}</span>}
      <div className="flex h-full flex-col border-l">
        <button type="button" aria-label="Subir" tabIndex={-1} onClick={() => onChange(clamp(value + step))} className="grid flex-1 place-items-center px-1.5 text-muted hover-fine:hover:text-fg">
          <ChevronUp className="size-3" />
        </button>
        <button type="button" aria-label="Bajar" tabIndex={-1} onClick={() => onChange(clamp(value - step))} className="grid flex-1 place-items-center border-t px-1.5 text-muted hover-fine:hover:text-fg">
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  );
}
