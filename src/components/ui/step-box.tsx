"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Casilla con flechas del Design final (Servicios): fondo de lámina, número en mono,
 * unidad gris a la derecha y la columna ▲▼ separada por una línea.
 * Escribe o usa ↑ ↓; se guarda sola cuando dejas de moverla (`onCommit`).
 */
export function StepBox({
  value,
  onCommit,
  step = 1,
  min = 0,
  max = 999_999,
  decimals = 0,
  prefix,
  unit,
  icon,
  tone,
  height = 40,
  minWidth = 78,
  arrowWidth = 26,
  label,
  readOnly,
  delay = 700,
}: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  prefix?: string;
  unit?: string;
  icon?: ReactNode;
  tone?: "danger";
  height?: number;
  minWidth?: number;
  arrowWidth?: number;
  label: string;
  readOnly?: boolean;
  delay?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [local, setLocal] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (seen !== value) {
    setSeen(value);
    setLocal(value);
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  const schedule = (n: number, now = false) => {
    setLocal(n);
    if (timer.current) clearTimeout(timer.current);
    if (n === value) return;
    if (now) onCommit(n);
    else timer.current = setTimeout(() => onCommit(n), delay);
  };
  const bump = (d: number) => schedule(clamp(local + d));
  const shown = draft ?? (decimals ? local.toFixed(decimals) : String(local));

  return (
    <span style={{ height }} className="inline-flex items-stretch overflow-hidden rounded-md border bg-bg focus-within:border-muted">
      <span style={{ minWidth }} className="inline-flex items-center justify-between gap-2 pr-2.5 pl-3">
        <span className="inline-flex items-center gap-[7px] text-muted">
          {icon}
          {prefix && <span className="text-[11px] text-faint">{prefix}</span>}
          <input
            aria-label={label}
            readOnly={readOnly}
            inputMode="decimal"
            value={shown}
            size={Math.max(1, shown.length)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft == null) return;
              const n = Number(draft.replace(",", "."));
              setDraft(null);
              if (Number.isFinite(n)) schedule(clamp(n), true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setDraft(null);
                bump(step);
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setDraft(null);
                bump(-step);
              }
            }}
            className={cn("bg-transparent p-0 font-mono text-[15px] tabular-nums outline-none", height < 38 && "text-[13.5px]", tone === "danger" ? "text-danger" : "text-fg")}
          />
        </span>
        {unit && <span className="font-mono text-[13px] text-faint">{unit}</span>}
      </span>
      {!readOnly && (
        <span className="flex flex-col border-l">
          <button type="button" tabIndex={-1} aria-label="Subir" onClick={() => bump(step)} style={{ width: arrowWidth }} className="grid flex-1 place-items-center text-muted hover-fine:hover:bg-hover hover-fine:hover:text-fg active:bg-line">
            <ChevronUp className="size-3" />
          </button>
          <span className="h-px bg-border" />
          <button type="button" tabIndex={-1} aria-label="Bajar" onClick={() => bump(-step)} style={{ width: arrowWidth }} className="grid flex-1 place-items-center text-muted hover-fine:hover:bg-hover hover-fine:hover:text-fg active:bg-line">
            <ChevronDown className="size-3" />
          </button>
        </span>
      )}
    </span>
  );
}

/** El valor que no se puede cambiar (Normal 0 %, ciclo 1–2 ×1.00): borde punteado. */
export function FixedBox({ children, unit, height = 40, minWidth = 96 }: { children: ReactNode; unit?: string; height?: number; minWidth?: number }) {
  return (
    <span style={{ height, minWidth }} className="inline-flex items-center justify-between gap-2 rounded-md border border-dashed px-3">
      <span className="font-mono text-sm text-faint">{children}</span>
      {unit && <span className="font-mono text-xs text-faint">{unit}</span>}
    </span>
  );
}
