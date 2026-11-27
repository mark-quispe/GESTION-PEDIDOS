"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { takeJob } from "@/actions/jobs";
import { initials } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Círculo con iniciales de quien lo tiene. */
export function Avatar({ name, className, ext }: { name: string | null | undefined; className?: string; ext?: boolean }) {
  return (
    <span
      className={cn(
        "inline-grid size-6 shrink-0 place-items-center rounded-full border bg-surface text-[9.5px] font-semibold tracking-tight",
        ext && "border-dashed",
        className,
      )}
    >
      {ext ? "EX" : initials(name)}
    </span>
  );
}

/**
 * Tomar (RF-47, RF-49): rectángulo de esquinas suaves con contorno y una flecha
 * en un cuadrito blanco. Si otra persona lo tomó antes, avisa quién.
 */
export function TakeButton({ jobId, className, size = "md", onDone, primary }: { jobId: string; className?: string; size?: "sm" | "md" | "lg"; onDone?: () => void; primary?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const click = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const r = await takeJob(jobId);
      if (r.ok) {
        toast.success("Es tuyo. Ya está en En proceso.");
        onDone?.();
      } else toast.error(r.error);
      router.refresh();
    });
  };
  if (primary)
    return (
      <button type="button" onClick={click} disabled={pending} className={cn("press take inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-60", className)}>
        {pending ? "Tomando…" : "Tomar pedido"}
        <ArrowRight className="arrow size-4" strokeWidth={2} />
      </button>
    );
  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      className={cn(
        "take inline-flex shrink-0 items-center gap-2 rounded-md border border-border-strong bg-surface pr-[3px] pl-[11px] font-medium whitespace-nowrap text-fg disabled:opacity-60",
        size === "sm" ? "h-[26px] text-xs" : size === "lg" ? "h-10 pl-3.5 text-sm" : "h-7 text-[12.5px]",
        className,
      )}
    >
      {pending ? "Tomando…" : "Tomar"}
      <span className={cn("grid place-items-center rounded bg-primary", size === "lg" ? "size-7" : "size-5")}>
        <ArrowRight className="arrow size-[11px] text-on-primary" strokeWidth={2.4} />
      </span>
    </button>
  );
}

/** Teclita de atajo ("P", "N", "/"). */
export function Kbd({ children, className, inverse }: { children: React.ReactNode; className?: string; inverse?: boolean }) {
  return (
    <span
      className={cn(
        "ml-1 inline-flex h-4 items-center rounded-[3px] border px-1 font-mono text-[10px]",
        inverse ? "border-on-primary/30 text-on-primary/60" : "border-border text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
