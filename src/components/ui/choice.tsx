"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = { value: T; label: ReactNode; sub?: ReactNode; disabled?: boolean };

/**
 * Botones de opción grandes (Medio, Urgencia, Estado inicial, Motivo…).
 * La opción elegida lleva contorno claro; el resto, contorno gris.
 */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  cols,
  tone = "neutral",
  size = "md",
}: {
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: ChoiceOption<T>[];
  label: string;
  className?: string;
  cols?: number;
  tone?: "neutral" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "press flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-2 text-center transition-[border-color,background-color,color] duration-150 disabled:opacity-40",
              size === "sm" ? "h-8 text-[12.5px]" : size === "lg" ? "min-h-14 py-2 text-sm" : "h-10 text-[13px]",
              active
                ? tone === "danger"
                  ? "border-danger bg-danger-soft text-danger"
                  : "border-fg bg-hover text-fg"
                : "border-border bg-surface text-fg-2 hover-fine:hover:border-border-strong",
            )}
          >
            <span className="truncate font-medium">{o.label}</span>
            {o.sub && <span className="truncate text-[11px] leading-tight">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
