import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tarjeta del Design final: fondo #1d1d1d, borde #363636, radio 8. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border bg-surface", className)} {...props} />;
}

export function CardHeader({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <h2 className={cn("flex min-h-[45px] items-center justify-between gap-3 border-b px-4 py-2.5 text-sm font-medium", className)}>
      <span className="flex min-w-0 items-center gap-2 truncate">{title}</span>
      {aside !== undefined && <span className="flex shrink-0 items-center gap-2 font-mono text-xs font-normal text-muted">{aside}</span>}
    </h2>
  );
}

/** Etiqueta pequeña en mono ("Pagos de hoy", "Entrega"). */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-mono text-[11px] text-muted", className)} {...props} />;
}

/** Estado vacío corto. */
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("px-4 py-6 text-center text-[13px] text-faint", className)}>{children}</p>;
}

/** Celda de dato en la ficha: etiqueta mono y valor. */
export function Stat({ label, children, className, valueClass }: { label: ReactNode; children: ReactNode; className?: string; valueClass?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-surface px-3 py-2.5", className)}>
      <p className="mb-1 font-mono text-[10.5px] text-muted">{label}</p>
      <div className={cn("truncate text-sm", valueClass)}>{children}</div>
    </div>
  );
}
