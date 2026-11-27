"use client";

import { Toaster as Sonner } from "sonner";

/** Avisos cortos ("Ana lo tomó hace un momento", "Pago registrado"). */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-surface !text-fg !shadow-[0_12px_40px_rgba(0,0,0,0.35)] !font-sans !text-[13px]",
          description: "!text-muted",
          error: "!text-danger",
          success: "!text-fg",
        },
      }}
    />
  );
}
