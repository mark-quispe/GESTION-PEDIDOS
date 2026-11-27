"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import type { PaymentKind, PaymentMethod } from "@/db/schema";
import { addJobNote, createJobFolder, deleteJob } from "@/actions/jobs";
import { addPayment, addRefund, correctPayment, deletePayment } from "@/actions/payments";
import { deleteJobFile } from "@/actions/files";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain";
import { cn, formatDateTime, formatDay, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { uploadJobFile } from "./file-uploader";

/* ---------- Confirmación genérica ---------- */

export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  action,
  variant = "ghost",
  icon,
  redirectTo,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
  variant?: "ghost" | "outline" | "destructive";
  icon?: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant={variant} size={label ? "sm" : "icon"} aria-label={label || title} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await action();
                  if (!res.ok) return setError(res.error ?? "No se pudo.");
                  setOpen(false);
                  if (redirectTo) router.push(redirectTo);
                })
              }
            >
              {pending ? "…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteJobButton({ id, code }: { id: string; code: string }) {
  return (
    <ConfirmButton
      label="Eliminar"
      icon={<Trash2 />}
      title={`¿Eliminar ${code}?`}
      description="Se oculta de todas las listas. Puedes restaurarlo desde Eliminados."
      confirmLabel="Eliminar"
      action={() => deleteJob(id)}
      redirectTo="/trabajos"
    />
  );
}

/* ---------- Pagos (RF-14 a RF-17, RF-42, RF-43) ---------- */

export type PaymentRow = {
  id: string;
  kind: PaymentKind;
  amount: string;
  paidOn: string;
  method: PaymentMethod;
  operationNumber: string | null;
  reason: string | null;
  receiptLink: string | null;
  createdBy: string;
  createdAt: string;
  corrections: { at: string; by: string; before: Record<string, unknown>; after: Record<string, unknown> }[];
};

function PaymentDialog({
  open,
  onOpenChange,
  jobId,
  today,
  kind,
  edit,
  canAttach,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  today: string;
  kind: PaymentKind;
  edit?: PaymentRow;
  canAttach: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const submit = (form: FormData) => {
    const v = (k: string) => String(form.get(k) ?? "");
    setError(null);
    startTransition(async () => {
      const base = { amount: v("amount").replace(",", "."), paidOn: v("paidOn"), method: v("method") as PaymentMethod, operationNumber: v("operationNumber") };
      const res = edit
        ? await correctPayment({ id: edit.id, ...base, reason: v("reason") })
        : kind === "pago"
          ? await addPayment({ jobId, ...base })
          : await addRefund({ jobId, ...base, reason: v("reason") });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      const paymentId = edit?.id ?? (res.data as { id: string } | undefined)?.id;
      if (receipt && paymentId) {
        try {
          setStep("Subiendo la captura…");
          await uploadJobFile({ jobId, folder: "pagos", file: receipt, paymentId });
        } catch (e) {
          setStep(null);
          setError(`El pago quedó registrado, pero la captura no se subió: ${e instanceof Error ? e.message : "error"}`);
          return;
        }
      }
      setStep(null);
      setReceipt(null);
      onOpenChange(false);
    });
  };
  const err = (k: string) => fieldErrors[k]?.[0];
  const title = edit ? "Corregir pago" : kind === "pago" ? "Registrar pago" : "Registrar devolución";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {edit ? "Queda en el historial el valor anterior y el nuevo." : kind === "pago" ? "Se registra como confirmado al momento." : "Se descuenta de lo pagado y queda en el historial."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            submit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monto (S/)" htmlFor="amount" error={err("amount")}>
              <Input id="amount" name="amount" inputMode="decimal" required autoFocus defaultValue={edit?.amount ?? ""} className="tabular-nums" />
            </Field>
            <Field label="Fecha" htmlFor="paidOn" error={err("paidOn")}>
              <Input id="paidOn" name="paidOn" type="date" required defaultValue={edit?.paidOn ?? today} />
            </Field>
            <Field label="Medio" htmlFor="method">
              <NativeSelect id="method" name="method" defaultValue={edit?.method ?? "yape"}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="N.º de operación" htmlFor="operationNumber" optional>
              <Input id="operationNumber" name="operationNumber" defaultValue={edit?.operationNumber ?? ""} />
            </Field>
            {(kind === "devolucion" || edit) && (
              <Field label={edit ? "Motivo de la corrección" : "Motivo"} htmlFor="reason" optional={!!edit} error={err("reason")} className="sm:col-span-2">
                <Input id="reason" name="reason" required={!edit} />
              </Field>
            )}
            {canAttach && kind === "pago" && (
              <Field label="Captura del Yape o la transferencia" htmlFor="receipt" optional className="sm:col-span-2" hint="Se guarda en la carpeta Pagos del trabajo en Drive.">
                <Input id="receipt" type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="py-2" />
              </Field>
            )}
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {step ?? (pending ? "Guardando…" : edit ? "Guardar corrección" : "Registrar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PAYMENT_FIELDS: [string, (v: unknown) => string][] = [
  ["amount", (v) => formatMoney(String(v))],
  ["paidOn", (v) => formatDay(String(v))],
  ["method", (v) => METHOD_LABELS[v as PaymentMethod] ?? String(v)],
  ["operationNumber", (v) => (v ? `op. ${v}` : "sin n.º de operación")],
];

/** Solo lo que cambió: "S/ 200.00 → S/ 250.00". */
const describeChange = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  PAYMENT_FIELDS.filter(([k]) => k in after && String(before[k] ?? "") !== String(after[k] ?? ""))
    .map(([k, fmt]) => `${fmt(before[k])} → ${fmt(after[k])}`)
    .join(" · ");

export function PaymentsPanel({
  jobId,
  rows,
  isAdmin,
  today,
  canAttach,
}: {
  jobId: string;
  rows: PaymentRow[];
  isAdmin: boolean;
  today: string;
  canAttach: boolean;
}) {
  const [dialog, setDialog] = useState<{ kind: PaymentKind; edit?: PaymentRow } | null>(null);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setDialog({ kind: "pago" })}>
          <Plus /> Registrar pago
        </Button>
        {isAdmin && (
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ kind: "devolucion" })}>
            <Undo2 /> Devolución
          </Button>
        )}
      </div>
      {rows.length ? (
        <ul className="divide-y rounded-md border">
          {rows.map((p) => (
            <li key={p.id} className="grid gap-1 px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn("font-medium tabular-nums", p.kind === "devolucion" && "text-danger")}>
                  {p.kind === "devolucion" ? "−" : ""}
                  {formatMoney(p.amount)}
                </span>
                <span className="text-muted-foreground">
                  {formatDay(p.paidOn, { day: "numeric", month: "short", year: "numeric" })} · {METHOD_LABELS[p.method]}
                  {p.operationNumber ? ` · op. ${p.operationNumber}` : ""}
                </span>
                {p.receiptLink && (
                  <a href={p.receiptLink} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                    Captura
                  </a>
                )}
                {isAdmin && (
                  <span className="ml-auto flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDialog({ kind: p.kind, edit: p })}>
                      <Pencil /> Corregir
                    </Button>
                    <ConfirmButton
                      label="Anular"
                      title="¿Anular este pago?"
                      description="Deja de contar en el saldo. Queda en Eliminados y se puede restaurar."
                      confirmLabel="Anular"
                      action={() => deletePayment(p.id)}
                    />
                  </span>
                )}
              </div>
              {p.reason && <p className="text-xs text-muted-foreground">Motivo: {p.reason}</p>}
              <p className="text-xs text-muted-foreground">
                Registró {p.createdBy} · {formatDateTime(p.createdAt)}
              </p>
              {p.corrections.map((c, i) => (
                <p key={i} className="text-xs text-warning">
                  Corregido por {c.by} el {formatDateTime(c.at)}: {describeChange(c.before, c.after)}
                  {c.after.motivo ? ` (${String(c.after.motivo)})` : ""}
                </p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
      )}
      {dialog && (
        <PaymentDialog
          key={`${dialog.kind}-${dialog.edit?.id ?? "nuevo"}`}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          jobId={jobId}
          today={today}
          kind={dialog.kind}
          edit={dialog.edit}
          canAttach={canAttach && !dialog.edit}
        />
      )}
    </div>
  );
}

/* ---------- Notas internas (RF-44) ---------- */

export function NoteForm({ jobId }: { jobId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await addJobNote({ jobId, body });
          if (!res.ok) return setError(res.error);
          setBody("");
          setError(null);
        });
      }}
    >
      <Textarea aria-label="Nueva nota" rows={2} placeholder="Resumen de lo conversado con el cliente…" value={body} onChange={(e) => setBody(e.target.value)} />
      <FormError message={error} />
      <Button type="submit" size="sm" variant="outline" className="justify-self-end" disabled={pending || !body.trim()}>
        {pending ? "Guardando…" : "Agregar nota"}
      </Button>
    </form>
  );
}

/* ---------- Drive (RF-23, RF-31) ---------- */

export function CreateFolderButton({ jobId, recreate }: { jobId: string; recreate?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await createJobFolder(jobId);
            setError(res.ok ? null : res.error);
          })
        }
      >
        <FolderPlus /> {pending ? "Creando…" : recreate ? "Volver a crear la carpeta" : "Crear carpeta en Drive"}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function DeleteFileButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmButton
      label=""
      icon={<Trash2 />}
      title={`¿Borrar ${name}?`}
      description="Se mueve a la papelera de Drive, donde se puede recuperar durante 30 días."
      confirmLabel="Borrar"
      action={() => deleteJobFile(id)}
    />
  );
}
