"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

/** Grupo de botones que se excluyen (Carga | Cotizaciones, En curso | Finalizados | Todos…). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 rounded-[7px] border bg-bg p-0.5", className)}>
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
              "press inline-flex items-center justify-center gap-1.5 rounded-[5px] px-2.5 font-medium whitespace-nowrap transition-colors duration-150",
              size === "sm" ? "h-[26px] text-[12.5px]" : "h-8 text-[13px]",
              active ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
