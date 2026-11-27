"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteClient } from "@/actions/clients";
import type { JobRow } from "@/lib/queries/jobs";
import { formatPhone, initials, STATUS_LABEL, statusTone } from "@/lib/domain";
import { dayMonth, dueLabel, timeAgo } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/badge";
import { useJobDialogs } from "@/components/jobs/job-dialogs";
import { ClientFormDialog, ObservationDialog, PreferencesDialog } from "@/components/clients/client-dialogs";
import { HoldButton } from "@/components/ui/hold-button";
import { DialogContent, DialogRoot } from "@/components/ui/dialog";

export type ClientDetailData = {
  id: string;
  name: string;
  whatsapp: string;
  university: string | null;
  career: string | null;
  cycle: number | null;
  source: string | null;
  createdAt: string;
  software: string | null;
  usualFormat: string | null;
  requestedFiles: string | null;
  otherPrefs: string | null;
  observations: { id: string; body: string; kind: string | null; alert: boolean; createdAt: string; author: string | null }[];
};


export function ClientDetail({ c, jobs, isAdmin, usualPerson }: { c: ClientDetailData; jobs: JobRow[]; isAdmin: boolean; usualPerson: string | null }) {
  const router = useRouter();
  const { openNewJob } = useJobDialogs();
  const [dialog, setDialog] = useState<null | "edit" | "prefs" | "obs" | "delete">(null);
  const [, start] = useTransition();
  const open = jobs.filter((j) => !["finalizado", "cancelado", "cotizacion"].includes(j.status));
  const pendingJobs = jobs.filter((j) => j.status !== "cancelado" && j.status !== "cotizacion" && j.pending > 0);
  const pending = pendingJobs.reduce((a, j) => a + j.pending, 0);
  const paid = jobs.reduce((a, j) => a + j.paid, 0);
  const last = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const since = new Intl.DateTimeFormat("es-PE", { month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(c.createdAt)).replace(".", "").toLowerCase();
  const subtitle = [c.university, c.career, c.cycle ? `${c.cycle}.º ciclo` : null].filter(Boolean).join(" · ");
  const debt = pendingJobs.reduce((a, j) => a + j.pending, 0);

  const newJob = () =>
    openNewJob({ client: { id: c.id, name: c.name, whatsapp: c.whatsapp, university: c.university, career: c.career, cycle: c.cycle, jobs: jobs.length, debt } });

  return (
    <article className="enter flex min-w-0 flex-1 flex-col gap-[18px] px-4 pt-4 pb-28 md:px-8 md:pt-7 md:pb-10">
      <Link href="/clientes" className="inline-flex items-center gap-1.5 text-[13px] text-muted md:hidden">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border bg-line text-base font-semibold">{initials(c.name)}</span>
          <div className="min-w-0">
            <h2 className="text-2xl leading-tight font-medium tracking-[-0.025em]">{c.name}</h2>
            <p className="mt-1 text-sm text-muted">{subtitle || "Sin universidad"}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px]">
              <a href={`https://wa.me/51${c.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-fg hover-fine:hover:underline">
                <MessageCircle className="size-3.5" /> {formatPhone(c.whatsapp)}
              </a>
              <span className="text-muted">
                desde {since}
                {c.source ? ` · ${c.source.toLowerCase()}` : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button size="icon" className="size-10 text-muted" aria-label="Eliminar cliente" title="Eliminar cliente" onClick={() => setDialog("delete")}>
              <Trash2 />
            </Button>
          )}
          <Button onClick={() => setDialog("edit")}>Editar</Button>
          <Button variant="primary" onClick={newJob}>
            <Plus /> Nuevo trabajo
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-surface md:grid-cols-4 [&>*]:border-line [&>*:nth-child(odd)]:border-r md:[&>*:not(:last-child)]:border-r [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label="Trabajos" value={jobs.length} sub={`${open.length} en curso`} />
        <Stat label="Total pagado" value={formatMoney(paid)} sub={`desde ${since}`} />
        <Stat label="Pendiente" value={formatMoney(pending)} tone={pending > 0 ? "text-warning" : undefined} sub={pendingJobs.length ? `de ${pendingJobs.map((j) => j.code).join(", ")}` : "al día"} />
        <Stat label="Último pedido" value={last ? dayMonth(last.createdAt) : "—"} sub={last ? timeAgo(last.createdAt) : ""} />
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <section className="flex h-[157px] flex-col gap-2.5 rounded-lg border bg-surface px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Preferencias</h3>
            <SmallBtn onClick={() => setDialog("prefs")}>
              <Pencil className="size-3" /> Editar
            </SmallBtn>
          </div>
          <div className="scroll-thin flex min-h-0 flex-col gap-2.5 overflow-y-auto">
            <Pref k="Software" v={c.software} />
            <Pref k="Formato" v={c.usualFormat} />
            {c.requestedFiles && <Pref k="Archivos" v={c.requestedFiles} />}
            {c.otherPrefs && <Pref k="Otras" v={c.otherPrefs} />}
            {isAdmin && <Pref k="Responsable habitual" v={usualPerson} />}
            <p className="text-xs text-faint">Se llenan solas en cada trabajo nuevo de {c.name.split(" ")[0]}.</p>
          </div>
        </section>
        <section className="flex h-[157px] flex-col gap-2.5 rounded-lg border bg-surface px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              Observaciones <span className="font-mono text-xs font-normal text-muted">{c.observations.length}</span>
            </h3>
            <SmallBtn onClick={() => setDialog("obs")}>
              <Plus className="size-3" /> Agregar
            </SmallBtn>
          </div>
          {/* RF-45: caja de alto fijo con scroll. */}
          <div className="relative min-h-0 flex-1">
            <ul className="scroll-thin flex h-full flex-col gap-1.5 overflow-y-auto pr-1.5 pb-4">
              {c.observations.length === 0 && <li className="py-3 text-center text-[13px] text-faint">Sin observaciones.</li>}
              {c.observations.map((o) => (
                <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-md border border-line bg-bg px-2.5 py-2">
                  <span className="text-[13px] leading-snug">
                    {o.body}
                    {o.alert && <span className="ml-1.5 text-[11px] text-warning">· avisa</span>}
                  </span>
                  <span className="text-right font-mono text-[11px] whitespace-nowrap text-faint">
                    {isAdmin && o.author && (
                      <>
                        {o.author}
                        <br />
                      </>
                    )}
                    {dayMonth(o.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
            <span aria-hidden className="pointer-events-none absolute right-2.5 bottom-0 left-0 h-[22px] bg-gradient-to-b from-transparent to-surface" />
          </div>
        </section>
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="text-[15px] font-medium">Trabajos y pagos</h3>
          <span className="text-xs text-muted">
            {jobs.length} trabajos · {pendingJobs.length} con pendiente
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] text-muted">
                <th className="px-4 py-2.5 font-normal">Código</th>
                <th className="px-4 py-2.5 font-normal">Trabajo</th>
                <th className="px-4 py-2.5 font-normal">Entrega</th>
                <th className="px-4 py-2.5 font-normal">Estado</th>
                <th className="px-4 py-2.5 text-right font-normal">Precio</th>
                <th className="px-4 py-2.5 text-right font-normal">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr className="border-t border-line">
                  <td colSpan={6} className="px-4 py-5 text-center text-[13px] text-faint">
                    Todavía no tiene trabajos.
                  </td>
                </tr>
              )}
              {[...jobs]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((j) => {
                  const tone = statusTone(j.status, j.late, !j.responsibleId && !j.externoId);
                  return (
                    <tr key={j.id} className="row cursor-pointer border-t border-line" onClick={() => router.push(`/trabajos/${j.code}`)}>
                      <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted">
                        <Link href={`/trabajos/${j.code}`}>{j.code}</Link>
                      </td>
                      <td className="max-w-64 truncate px-4 py-2.5 text-sm">{j.title}</td>
                      <td className={cn("px-4 py-2.5 font-mono text-xs", dueLabel(j.dueAt) === "Hoy" && !["finalizado", "cancelado"].includes(j.status) ? "text-warning" : "text-muted")}>{dueLabel(j.dueAt)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs whitespace-nowrap">
                          <Dot tone={tone} className="size-1.5" />
                          {STATUS_LABEL[j.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[13px]">{formatMoney(j.total)}</td>
                      <td className={cn("px-4 py-2.5 text-right font-mono text-[13px]", j.status === "cancelado" || j.status === "cotizacion" ? "text-faint" : j.pending > 0 ? "text-warning" : "text-success")}>
                        {j.status === "cancelado" || j.status === "cotizacion" ? "—" : j.pending > 0 ? formatMoney(j.pending) : "Pagado"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <ClientFormDialog open={dialog === "edit"} onOpenChange={(v) => setDialog(v ? "edit" : null)} client={c} />
      <PreferencesDialog
        open={dialog === "prefs"}
        onOpenChange={(v) => setDialog(v ? "prefs" : null)}
        isAdmin={isAdmin}
        prefs={{ id: c.id, name: c.name, subtitle: `${c.name}${subtitle ? ` · ${subtitle}` : ""}`, software: c.software, usualFormat: c.usualFormat, requestedFiles: c.requestedFiles, otherPrefs: c.otherPrefs, usualPerson }}
      />
      <ObservationDialog open={dialog === "obs"} onOpenChange={(v) => setDialog(v ? "obs" : null)} clientId={c.id} title={`${c.name} · ${c.observations.length} observaciones`} />
      <DialogRoot open={dialog === "delete"} onOpenChange={(v) => setDialog(v ? "delete" : null)}>
        {dialog === "delete" && (
          <DialogContent
            title={`Eliminar a ${c.name}`}
            description="No se borra de verdad: se oculta y el admin lo puede restaurar desde Eliminados. Sus trabajos siguen igual."
            footer={
              <>
                <Button size="md" onClick={() => setDialog(null)}>
                  Volver
                </Button>
                <HoldButton
                  onConfirm={() =>
                    start(async () => {
                      const r = await deleteClient(c.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Cliente eliminado. Está en Eliminados.");
                      router.push("/clientes");
                      router.refresh();
                    })
                  }
                >
                  Mantén 2 s para eliminar
                </HoldButton>
              </>
            }
          >
            <p className="text-sm text-muted">Tiene {jobs.length} trabajos registrados.</p>
          </DialogContent>
        )}
      </DialogRoot>
    </article>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="font-mono text-[11px] text-muted">{label}</p>
      <p className={cn("mt-1.5 mb-0.5 font-mono text-xl", tone)}>{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press inline-flex h-[26px] items-center gap-1.5 rounded-[5px] border px-2 text-xs text-muted hover-fine:hover:text-fg">
      {children}
    </button>
  );
}

function Pref({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className={cn("text-right", !v && "text-faint")}>{v || "Sin indicar"}</span>
    </div>
  );
}
