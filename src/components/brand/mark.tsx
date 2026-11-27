import { cn } from "@/lib/utils";

/**
 * Marca del estudio: el símbolo de una puerta batiente en planta
 * (muro, hoja y arco de giro). Hereda el color del texto.
 * `draw` traza el arco una sola vez al aparecer (solo en el login).
 */
export function Mark({ className, draw = false }: { className?: string; draw?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="square"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      {/* muro */}
      <path d="M2.5 20.5h4M17.5 20.5h4" />
      {/* hoja de la puerta */}
      <path d="M6.5 20.5V5.5" />
      {/* arco de giro */}
      <path d="M6.5 5.5a15 15 0 0 1 15 15" className={cn(draw && "mark-draw")} pathLength={1} strokeDasharray={draw ? 1 : undefined} />
    </svg>
  );
}
