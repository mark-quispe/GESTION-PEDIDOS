"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { logout, setViewAsEmployee } from "@/actions/session";

/** RF-53: marca siempre visible de la demo, con Salir de la demo. */
export function DemoBanner() {
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-3 border-b border-info-line bg-[color-mix(in_srgb,var(--info)_10%,var(--bg))] px-4 py-2 text-[13px]">
      <span className="font-mono text-[11px] tracking-wider text-info">DEMO</span>
      <span className="text-fg-2">Estás viendo el estudio con datos de ejemplo. Lo que cambies se borra cada noche.</span>
      <form action={logout}>
        <button type="submit" className="press font-medium text-info underline-offset-4 hover-fine:hover:underline">
          Salir de la demo
        </button>
      </form>
    </div>
  );
}

/** RF-03: aviso arriba mientras el admin ve la app como empleado. */
export function ViewAsBanner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-info-line bg-info-soft px-4 py-2.5 text-[13px]">
      <Eye className="size-4 text-info" />
      <span className="min-w-0 flex-1 text-fg-2">Vista de empleado. Ves lo mismo que el equipo. Lo que registres queda a tu nombre.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setViewAsEmployee(false);
            router.refresh();
          })
        }
        className="press inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-2.5 text-[12.5px] font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Volver a administrador
        <span className="font-mono text-[11px] text-faint">⇧ E</span>
      </button>
    </div>
  );
}
