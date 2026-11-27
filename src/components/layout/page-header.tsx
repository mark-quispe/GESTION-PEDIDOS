import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cabecera de cada pestaña: número y contexto en mono, título y una línea.
 * "01 · sábado, 21 de noviembre · semana 47" / Inicio / Lo que hay que entregar…
 */
export function PageHeader({
  n,
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  n: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4 border-b pb-4", className)}>
      <div className="min-w-0">
        <p className="mb-1.5 font-mono text-xs text-muted">
          {n}
          {eyebrow ? <> · {eyebrow}</> : null}
        </p>
        <h1 className="text-[28px] leading-tight font-medium tracking-[-0.025em] md:text-[30px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Contenedor de la página con el fondo de lámina. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-1 flex-col gap-[18px] px-4 pt-3 pb-28 md:px-9 md:pt-[30px] md:pb-8", className)}>{children}</div>;
}
