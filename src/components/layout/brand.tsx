import { cn } from "@/lib/utils";

/** Marca: símbolo de puerta en planta (muro, hoja y arco de giro). */
export function BrandMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden className={className}>
      <path d="M2.5 20.5h4M17.5 20.5h4M6.5 20.5V5.5" />
      <path d="M6.5 5.5a15 15 0 0 1 15 15" />
    </svg>
  );
}

export function BrandTile({ className, size = 36, name, sub = "Gestión de pedidos" }: { className?: string; size?: number; name: string; sub?: string | null }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="grid shrink-0 place-items-center rounded-md border bg-bg text-fg" style={{ width: size, height: size }}>
        <BrandMark size={Math.round(size * 0.56)} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-medium">{name}</span>
        {sub && <span className="block truncate font-mono text-[11px] text-muted">{sub}</span>}
      </span>
    </div>
  );
}
