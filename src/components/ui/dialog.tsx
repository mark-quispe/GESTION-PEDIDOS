"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Ventanas flotantes. Fondo de todas las ventanas: semidifuminado
 * (negro 50 % + desenfoque 2 px), decidido por Mark el 23/11.
 * - Dialog: centrada, entra desde 0.96 con ease-out (las modales no tienen origen).
 * - Sheet: panel a la derecha (Registrar pago, Nuevo ítem, + Agregar).
 */
export const DialogRoot = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  wide,
  footer,
  eyebrow,
  hideClose,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean | "xl";
  footer?: ReactNode;
  eyebrow?: ReactNode;
  hideClose?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="overlay fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "modal fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)] focus:outline-none",
          wide === "xl" ? "max-w-[1080px]" : wide ? "max-w-[760px]" : "max-w-[480px]",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 font-mono text-[11px] text-muted">{eyebrow}</div>}
            <D.Title className="text-lg font-medium tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>}
          </div>
          {!hideClose && (
            <D.Close className="press -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover-fine:hover:bg-hover hover-fine:hover:text-fg" aria-label="Cerrar">
              <X className="size-4" />
            </D.Close>
          )}
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-bg/40 px-5 py-3">{footer}</footer>}
      </D.Content>
    </D.Portal>
  );
}

export function SheetContent({
  title,
  description,
  children,
  footer,
  className,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
}) {
  return (
    <D.Portal>
      <D.Overlay className="overlay fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]" />
      <D.Content
        className={cn(
          "sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l bg-surface shadow-[0_0_80px_rgba(0,0,0,0.45)] focus:outline-none",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 font-mono text-[11px] text-muted">{eyebrow}</div>}
            <D.Title className="text-lg font-medium tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>}
          </div>
          <D.Close className="press -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover-fine:hover:bg-hover hover-fine:hover:text-fg" aria-label="Cerrar">
            <X className="size-4" />
          </D.Close>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</footer>}
      </D.Content>
    </D.Portal>
  );
}
