"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Botón que hay que mantener presionado 2 segundos (RF-04 quitar acceso, RF-63 anular).
 * El relleno avanza lento y lineal mientras decides, y vuelve rápido al soltar (Emil).
 * Con teclado: mantener Enter o Espacio.
 */
export function HoldButton({
  onConfirm,
  children,
  className,
  disabled,
  ms = 2000,
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  ms?: number;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    if (disabled) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, ms);
  };
  const stop = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      data-holding={holding}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={stop}
      onBlur={stop}
      className={cn(
        "hold press inline-flex h-10 items-center justify-center gap-2 rounded-md border border-danger-line bg-danger-soft px-4 text-sm font-medium text-danger select-none disabled:opacity-45",
        className,
      )}
    >
      <span className="hold-fill" aria-hidden style={{ transitionDuration: holding ? `${ms}ms` : undefined }} />
      {children}
    </button>
  );
}
