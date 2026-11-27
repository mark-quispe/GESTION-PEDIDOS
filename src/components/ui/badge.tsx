import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain";

const tones: Record<Tone, string> = {
  danger: "border-danger-line text-danger",
  warning: "border-warning-line text-warning",
  info: "border-info-line text-info",
  success: "border-success-line text-success",
  neutral: "border-border text-muted",
  strong: "border-border-strong text-fg",
  muted: "border-border text-faint",
};

/** Etiqueta redonda con contorno ("+2 días", "Urgente"). */
export function Pill({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full border px-2 text-xs whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

const dotTones: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
  neutral: "bg-faint",
  strong: "bg-fg",
  muted: "bg-border",
};

/** Punto de estado (los atrasados llevan punto rojo en todas las listas, RF-12). */
export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-[7px] shrink-0 rounded-full", dotTones[tone], className)} />;
}

export const toneText: Record<Tone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  success: "text-success",
  neutral: "text-muted",
  strong: "text-fg",
  muted: "text-faint",
};

/** Barra fina de prioridad a la izquierda (rojo Urgente, ámbar Alta, gris Normal). */
export const urgencyBar = { urgente: "bg-danger", alta: "bg-warning", normal: "bg-border-strong" } as const;
