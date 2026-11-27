"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getNewJobData, type NewJobData } from "@/actions/catalog";
import { NewJobDialog, type NewJobPrefill } from "@/components/jobs/new-job-dialog";
import { PaymentSheet, RefundDialog, type RefundPreset } from "@/components/jobs/payment-sheet";

type Ctx = {
  openNewJob: (prefill?: NewJobPrefill) => void;
  openPayment: (jobId?: string | null) => void;
  openRefund: (preset: RefundPreset) => void;
};

const JobDialogsContext = createContext<Ctx | null>(null);

export function useJobDialogs() {
  const c = useContext(JobDialogsContext);
  if (!c) throw new Error("useJobDialogs fuera del proveedor");
  return c;
}

/**
 * Ventanas que se abren desde cualquier pestaña: Nuevo trabajo (N) y
 * Registrar pago (P). Nuevo trabajo se abre siempre como ventana flotante (RF-12).
 */
export function JobDialogsProvider({ children, driveReady }: { children: ReactNode; driveReady: boolean }) {
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<NewJobPrefill | null>(null);
  const [data, setData] = useState<NewJobData | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payJob, setPayJob] = useState<string | null>(null);
  const [refund, setRefund] = useState<RefundPreset | null>(null);

  const openNewJob = useCallback((p?: NewJobPrefill) => {
    setPrefill(p ?? null);
    setNewOpen(true);
    // Los datos del tarifario se piden al abrir, no en cada página (RNF-12).
    getNewJobData().then(setData);
  }, []);
  const openPayment = useCallback((jobId?: string | null) => {
    setPayJob(jobId ?? null);
    setPayOpen(true);
  }, []);
  const openRefund = useCallback((p: RefundPreset) => setRefund(p), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        openNewJob();
      } else if (k === "p") {
        e.preventDefault();
        const m = location.pathname.match(/^\/trabajos\/([^/]+)/);
        const id = m ? document.querySelector<HTMLElement>("[data-job-id]")?.dataset.jobId : null;
        openPayment(id ?? null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewJob, openPayment]);

  return (
    <JobDialogsContext.Provider value={{ openNewJob, openPayment, openRefund }}>
      {children}
      <NewJobDialog open={newOpen} onOpenChange={setNewOpen} data={data} prefill={prefill} />
      <PaymentSheet open={payOpen} onOpenChange={setPayOpen} jobId={payJob} driveReady={driveReady} />
      <RefundDialog preset={refund} onClose={() => setRefund(null)} driveReady={driveReady} />
    </JobDialogsContext.Provider>
  );
}
