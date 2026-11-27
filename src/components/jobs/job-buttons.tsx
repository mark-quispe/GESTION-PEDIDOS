"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/jobs/bits";
import { useJobDialogs } from "@/components/jobs/job-dialogs";
import { cn } from "@/lib/utils";

/** Registrar pago (P) y + Nuevo (N), iguales en Inicio y en Trabajos. */
export function JobActionButtons({ size = "md", long, jobId, className }: { size?: "md" | "lg"; long?: boolean; jobId?: string; className?: string }) {
  const { openNewJob, openPayment } = useJobDialogs();
  return (
    <div className={cn("flex gap-1.5", className)}>
      <Button size={size} onClick={() => openPayment(jobId ?? null)}>
        {long ? "Registrar pago" : <span className="md:hidden">Pago</span>}
        {!long && <span className="hidden md:inline">Registrar pago</span>}
        <Kbd className="hidden md:inline-flex">P</Kbd>
      </Button>
      <Button size={size} variant="primary" onClick={() => openNewJob()}>
        <Plus strokeWidth={2} />
        {long ? "Nuevo trabajo" : "Nuevo"}
        <Kbd inverse className="hidden md:inline-flex">
          N
        </Kbd>
      </Button>
    </div>
  );
}
