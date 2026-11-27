"use client";

import { cn } from "@/lib/utils";

/**
 * Interruptor del Design final. «sm» 30 × 18 (Usuarios), «md» 34 × 20 con borde (Producción).
 * Encendido blanco con perilla oscura; «implícito» en gris (admin incluye todo).
 */
export function Switch({
  on,
  onChange,
  label,
  disabled,
  implied,
  size = "sm",
  title,
}: {
  on: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  implied?: boolean;
  size?: "sm" | "md";
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={cn(
        "press inline-flex shrink-0 rounded-full transition-colors duration-200 disabled:cursor-default",
        size === "sm" ? "h-[18px] w-[30px] p-0.5" : "h-5 w-[34px] border p-[2px]",
        on ? (implied ? "border-faint bg-faint" : "border-fg bg-fg") : size === "md" ? "border-[#4a4a4a] bg-line" : "bg-border",
      )}
    >
      <span
        className={cn(
          "rounded-full transition-transform duration-200 ease-(--ease-out)",
          size === "sm" ? "size-3.5" : "size-3.5 self-center",
          on ? (size === "sm" ? "translate-x-3 bg-bg" : "translate-x-[14px] bg-bg") : size === "sm" ? "bg-muted" : "bg-faint",
        )}
      />
    </button>
  );
}
