"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  FolderOpen,
  List,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addNote,
  confirmQuote,
  correctionDone,
  finalizeJob,
  markFinished,
  markSent,
  reopenJob,
  setJobField,
  toggleItem,
} from "@/actions/jobs";
import type { UrgencyConfig } from "@/db/schema";
import type { JobRow } from "@/lib/queries/jobs";
import {
  formatDeadline,
  formatPhone,
  initials,
  isLate,
  METHOD_LABEL,
  paidNet,
  PAY_STATE_LABEL,
  payState,
  round2,
  STATUS_LABEL,
  STATUS_STEPS,
} from "@/lib/domain";
import { dayKey, dayMonth, dayMonthNum, dueLabel, timeAgo, timeLima, todayLima, weekdayShort } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { Avatar, TakeButton } from "@/components/jobs/bits";
import { filterRows } from "@/components/jobs/job-list";
import { JobsPanel } from "@/components/jobs/jobs-panel";
import { JobActionButtons } from "@/components/jobs/job-buttons";
import { useJobDialogs } from "@/components/jobs/job-dialogs";
import { ClientSummaryDialog, type SummaryData } from "@/components/jobs/client-summary";
import { CancelDialog, CorrectionDialog, EditDialog, ReleaseDialog, VoidPaymentDialog } from "@/components/jobs/job-file-dialogs";
import type { HistoryEntry, JobJSON, Me } from "@/components/jobs/types";

type Studio = { name: string; whatsapp: string | null; facebook: string | null; instagram: string | null; logoUrl?: string | null };
type Tab = "resumen" | "archivos" | "notas" | "historial";

export function JobFile({
  job,
  history,
  rows,
  externos,
  me,
  urgency,
  lastSeen,
  driveReady,
  studio,
}: {
  job: JobJSON;
  history: HistoryEntry[];
  rows: JobRow[];
  externos: { id: string; name: string }[];
  me: Me;
  urgency: UrgencyConfig;
  lastSeen: string | null;
  driveReady: boolean;
  studio: Studio;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [listOpen, setListOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "release" | "correction" | "edit" | "cancel">(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  // Navegación ‹ 3 de 12 › entre los trabajos en curso (J / K).
  const nav = useMemo(() => {
    const open = filterRows(rows, "curso", "");
    const list = open.some((r) => r.id === job.id) ? open : rows;
    const i = list.findIndex((r) => r.id === job.id);
    return { list, i, prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null, openCount: open.length };
  }, [rows, job.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || document.querySelector("[role=dialog]")) {
        if (e.key === "Escape" && listOpen) setListOpen(false);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape" && listOpen) setListOpen(false);
      else if (e.key === "j" && nav.next) router.push(`/trabajos/${nav.next.code}`);
      else if (e.key === "k" && nav.prev) router.push(`/trabajos/${nav.prev.code}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, router, listOpen]);

  const money = useMemo(() => {
    const extras = round2(job.extras.reduce((a, e) => a + e.amount, 0));
    const total = round2(job.price + extras);
    const paid = paidNet(job.payments);
    return { extras, total, paid, pending: round2(Math.max(0, total - paid)), state: payState(total, paid) };
  }, [job]);

  const unreadNotes = job.notes.filter((n) => n.author?.id !== me.id && (!lastSeen || n.createdAt > lastSeen)).length;
  const late = isLate(job.status, job.dueAt);
  const closed = job.status === "finalizado" || job.status === "cancelado";
  const factor = job.items.find((i) => i.pricingMode === "ciclo")?.factor ?? null;

  const summaryData = (): SummaryData => ({
    code: job.code,
    date: job.createdAt,
    clientName: job.client.name,
    clientPhone: job.client.whatsapp,
    course: job.course,
    cycle: job.cycle,
    dueAt: job.dueAt,
    urgency: job.urgency,
    deadlineLabel: formatDeadline(urgency[job.urgency].hours),
    lines: job.items.map((i) => ({ name: i.categoryCode === "OT" ? (i.detail ?? i.name) : i.name, quantity: i.quantity, unit: i.unit, amount: i.amount })),
    subtotal: round2(job.items.reduce((a, i) => a + i.amount, 0)),
    surcharge: round2(job.items.reduce((a, i) => a + i.amount, 0) * (job.urgencyPct / 100)),
    extra: job.complexityExtra,
    total: money.total,
    paid: money.paid,
    studio,
    isQuote: job.status === "cotizacion",
  });

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col" data-job-id={job.id}>
      <article aria-label="Ficha del trabajo" className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-3 pb-28 md:px-9 md:pt-7 md:pb-10">
        {/* Barra de arriba */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3.5">
          <JobActionButtons jobId={job.id} />
          <div className="flex items-center gap-2.5">
            {nav.next && (
              <Link href={`/trabajos/${nav.next.code}`} className="hidden max-w-[300px] truncate text-xs text-faint xl:block">
                Siguiente: <span className="text-muted">{nav.next.code} · {nav.next.title}</span>
              </Link>
            )}
            <div className="flex items-center gap-0.5">
              <NavBtn label="Anterior (K)" href={nav.prev ? `/trabajos/${nav.prev.code}` : null}>
                <ChevronLeft className="size-4" />
              </NavBtn>
              <span className="px-2 font-mono text-xs whitespace-nowrap text-muted">{nav.i >= 0 ? `${nav.i + 1} de ${nav.list.length}` : "—"}</span>
              <NavBtn label="Siguiente (J)" href={nav.next ? `/trabajos/${nav.next.code}` : null}>
                <ChevronRight className="size-4" />
              </NavBtn>
            </div>
            <Button size="md" onClick={() => setListOpen(true)} aria-expanded={listOpen}>
              Trabajos <span className="hidden font-mono text-[11px] font-normal text-muted sm:inline">En curso · {nav.openCount}</span>
              <List className="size-4" />
            </Button>
          </div>
        </div>

        <Header job={job} me={me} money={money} setDialog={setDialog} />
        <StateBanner job={job} money={money} me={me} />

        <StatusSteps job={job} history={history} />

        <div role="tablist" aria-label="Partes de la ficha" className="flex gap-5 overflow-x-auto border-b [scrollbar-width:none]">
          {(
            [
              ["resumen", "Resumen", null],
              ["archivos", "Archivos", job.files.length || null],
              ["notas", "Notas", unreadNotes || null],
              ["historial", "Historial", null],
            ] as const
          ).map(([k, label, n]) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "relative flex h-9 shrink-0 items-center gap-1.5 px-0.5 text-[13px] font-medium transition-colors duration-150",
                tab === k ? "text-fg" : "text-muted hover-fine:hover:text-fg",
              )}
            >
              {label}
              {n !== null && (
                <span className={cn("inline-grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[10px]", k === "notas" ? "bg-warning text-bg" : "text-muted")}>{n}</span>
              )}
              {tab === k && <span className="tab-underline absolute inset-x-0 -bottom-px h-0.5 bg-fg" />}
            </button>
          ))}
        </div>

        {tab === "resumen" && (
          <div key="resumen" className="enter flex flex-col gap-5">
            <DataGrid job={job} me={me} late={late} closed={closed} factor={factor} />
            <ItemsSection job={job} me={me} closed={closed} onSummary={() => setSummary(summaryData())} onEdit={() => setDialog("edit")} />
            {job.extras.length > 0 && <ExtrasSection job={job} />}
            <PaymentsSection job={job} me={me} money={money} />
            <RelatedSection job={job} />
            {job.notes[0] && (
              <section className="rounded-lg border bg-surface px-4 py-3.5">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] text-muted">
                    Última nota · {job.notes[0].author?.name ?? "—"} · {timeAgo(job.notes[0].createdAt)}
                  </p>
                  <button type="button" onClick={() => setTab("notas")} className="text-xs text-info">
                    Ver bitácora
                  </button>
                </div>
                <p className="mt-1.5 text-sm">{job.notes[0].body}</p>
              </section>
            )}
          </div>
        )}
        {tab === "archivos" && <FilesTab job={job} me={me} driveReady={driveReady} />}
        {tab === "notas" && <NotesTab job={job} lastSeen={lastSeen} meId={me.id} />}
        {tab === "historial" && <HistoryTab history={history} />}
      </article>

      {/* La lista sale de derecha a izquierda encima de la ficha (RF-12). */}
      {listOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setListOpen(false)}>
          <div className="overlay absolute inset-0 bg-scrim backdrop-blur-[2px]" data-state="open" />
          <section
            aria-label="Lista de trabajos"
            onClick={(e) => e.stopPropagation()}
            className="sheet absolute inset-y-0 right-0 flex w-full max-w-[580px] flex-col border-l bg-side pt-5"
            data-state="open"
          >
            <JobsPanel rows={rows} activeCode={job.code} canTake={me.canTake} meId={me.id} onClose={() => setListOpen(false)} />
          </section>
        </div>
      )}

      <ReleaseDialog job={job} open={dialog === "release"} onOpenChange={(v) => setDialog(v ? "release" : null)} me={me} />
      <CorrectionDialog job={job} open={dialog === "correction"} onOpenChange={(v) => setDialog(v ? "correction" : null)} me={me} externos={externos} driveReady={driveReady} />
      <EditDialog job={job} open={dialog === "edit"} onOpenChange={(v) => setDialog(v ? "edit" : null)} urgency={urgency} externos={externos} />
      <CancelDialog job={job} open={dialog === "cancel"} onOpenChange={(v) => setDialog(v ? "cancel" : null)} driveReady={driveReady} />
      <ClientSummaryDialog data={summary} onClose={() => setSummary(null)} />
    </div>
  );
}

function NavBtn({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const cls = "press grid size-[34px] place-items-center rounded-md border bg-surface";
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cn(cls, "hover-fine:hover:border-border-strong")}>
      {children}
    </Link>
  ) : (
    <span aria-hidden className={cn(cls, "text-faint opacity-50")}>
      {children}
    </span>
  );
}

/* ---------- Cabecera y botones según el estado (RF-09) ---------- */

type Money = { extras: number; total: number; paid: number; pending: number; state: ReturnType<typeof payState> };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  return { pending, run };
}

function Header({ job, me, money, setDialog }: { job: JobJSON; me: Me; money: Money; setDialog: (d: "release" | "correction" | "edit" | "cancel") => void }) {
  const { openNewJob } = useJobDialogs();
  const { pending, run } = useAct();
  const s = job.status;
  const mine = job.responsibleId === me.id;
  const unassigned = !job.responsibleId && !job.externoId;
  const allDone = job.items.every((i) => i.doneAt);
  const canMark = mine || job.externoId || me.isAdmin;
  const hasRefund = job.payments.some((p) => p.kind === "devolucion" && !p.voidedAt);

  const continueJob = () =>
    openNewJob({
      client: { id: job.client.id, name: job.client.name, whatsapp: job.client.whatsapp, university: job.client.university, career: job.client.career, cycle: job.client.cycle, jobs: 0, debt: 0 },
      continues: { id: job.id, code: job.code, title: job.title, finishedAt: job.finishedAt, cycle: job.cycle, course: job.course, professor: job.professor, section: job.section, retake: s === "cancelado" },
    });

  const trash = (
    <Button variant="danger" size="icon" aria-label="Anular pedido" title="Anular pedido" onClick={() => setDialog("cancel")} className="size-10">
      <Trash2 />
    </Button>
  );
  const edit = (
    <Button onClick={() => setDialog("edit")}>Editar</Button>
  );

  let actions: ReactNode;
  if (s === "cancelado") {
    actions = hasRefund ? (
      <>
        <span className="text-xs text-faint">Ya se devolvió el dinero: no se reabre</span>
        <Button variant="primary" onClick={continueJob}>
          <Plus /> Nuevo pedido desde este
        </Button>
      </>
    ) : (
      <Button onClick={() => run(() => reopenJob(job.id), "Reabierto.")} disabled={pending}>
        <RotateCcw /> Reabrir
      </Button>
    );
  } else if (s === "finalizado") {
    actions = (
      <>
        {me.isAdmin ? edit : <Button disabled>Editar <span className="font-normal text-faint">· solo admin</span></Button>}
        <Button variant="primary" onClick={continueJob}>
          <Plus /> Continuar trabajo
        </Button>
      </>
    );
  } else if (s === "cotizacion") {
    actions = (
      <>
        {trash}
        {edit}
        <Button variant="primary" onClick={() => run(() => confirmQuote(job.id), "Confirmado: ya está en Trabajos por tomar.")} disabled={pending}>
          <Check /> Confirmar
        </Button>
      </>
    );
  } else if (s === "terminado") {
    actions = (
      <>
        {trash}
        {edit}
        <Button variant="primary" onClick={() => run(() => markSent(job.id), "Enviado al cliente.")} disabled={pending}>
          <Send /> Enviado al cliente
        </Button>
      </>
    );
  } else if (s === "en_revision") {
    actions = (
      <>
        {trash}
        {edit}
        <Button onClick={() => setDialog("correction")}>Pidió correcciones</Button>
        <Button variant="primary" onClick={() => run(() => finalizeJob(job.id), "Finalizado.")} disabled={pending}>
          <CircleCheck /> Finalizar
        </Button>
      </>
    );
  } else if (s === "correcciones") {
    actions = (
      <>
        {trash}
        {edit}
        {mine && (
          <Button variant="ghost" className="border" onClick={() => setDialog("release")}>
            <Undo2 /> Soltar
          </Button>
        )}
        {unassigned && me.canTake ? (
          <TakeButton jobId={job.id} primary />
        ) : (
          canMark && (
            <Button variant="primary" onClick={() => run(() => correctionDone(job.id), "Corrección hecha: pasa a Terminado.")} disabled={pending}>
              Corrección hecha
            </Button>
          )
        )}
      </>
    );
  } else {
    // confirmado / en_proceso
    actions = (
      <>
        {trash}
        {edit}
        {!unassigned && (mine || job.externoId || me.isAdmin) && (
          <Button onClick={() => setDialog("correction")}>
            <Wrench className="!size-3.5" /> Corrección <span className="font-mono text-[11px] font-normal text-muted">{job.correctionRounds}/2</span>
          </Button>
        )}
        {mine && (
          <Button variant="ghost" className="border" onClick={() => setDialog("release")}>
            <Undo2 /> Soltar
          </Button>
        )}
        {unassigned ? (
          <>
            <Button disabled title="Primero alguien tiene que tomarlo">
              Marcar terminado
            </Button>
            {me.canTake && <TakeButton jobId={job.id} primary />}
          </>
        ) : (
          canMark && (
            <Button
              variant="primary"
              disabled={pending || !allDone}
              title={allDone ? undefined : "Marca todos los ítems primero"}
              onClick={() => run(() => markFinished(job.id), "Terminado · por enviar.")}
            >
              Marcar terminado
            </Button>
          )
        )}
      </>
    );
  }

  const urg = job.urgency === "urgente" ? <Pill tone="danger" className="h-5 px-[7px] text-[11px]">Urgente</Pill> : job.urgency === "alta" ? <Pill tone="warning" className="h-5 px-[7px] text-[11px]">Alta</Pill> : null;
  const stateTag =
    s === "finalizado" ? (
      <Pill tone="success" className="h-5 bg-success-soft px-[7px] text-[11px]">Finalizado</Pill>
    ) : s === "cancelado" ? (
      <Pill tone="danger" className="h-5 bg-danger-soft px-[7px] text-[11px]">Cancelado</Pill>
    ) : null;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          {job.code} {stateTag ?? urg}
        </p>
        <h2 className="mt-2 mb-1 text-[22px] leading-tight font-medium tracking-[-0.025em] md:text-[26px]">{job.title}</h2>
        <p className="text-[15px] text-muted">
          <Link href={`/clientes/${job.client.id}`} className="underline decoration-border-strong underline-offset-[3px] hover-fine:hover:text-fg">
            {job.client.name}
          </Link>
          {[job.university ?? job.client.university, job.client.career].filter(Boolean).map((x) => ` · ${x}`)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {money.state === "de_mas" && <span className="sr-only">Pagado de más</span>}
    </header>
  );
}

/* ---------- Franjas por estado ---------- */

function StateBanner({ job, money, me }: { job: JobJSON; money: Money; me: Me }) {
  const { openPayment, openRefund } = useJobDialogs();
  const s = job.status;
  const corr = job.corrections.filter((c) => !c.doneAt).at(-1);
  if (s === "cancelado") {
    const refunded = round2(job.payments.filter((p) => p.kind === "devolucion" && !p.voidedAt).reduce((a, p) => a + p.amount, 0));
    return (
      <div className="enter flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft px-4 py-3">
        <X className="size-4 text-danger" />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="text-danger">
            Cancelado el {job.cancelledAt ? dayMonthNum(job.cancelledAt) : "—"} por {job.cancelledBy?.name ?? "—"} · {job.cancelReason}
          </p>
          {job.cancelNote && <p className="text-muted">«{job.cancelNote}»</p>}
        </div>
        <p className="text-right text-xs text-muted">
          {refunded > 0 ? "Se le devolvió" : "Se quedó con"}
          <span className="block font-mono text-base text-fg">{formatMoney(refunded > 0 ? refunded : money.paid)}</span>
        </p>
      </div>
    );
  }
  if (s === "finalizado")
    return (
      <div className="enter flex flex-wrap items-center gap-3 rounded-lg border border-success-line bg-success-soft px-4 py-3 text-[13px]">
        <CircleCheck className="size-4 text-success" />
        <p className="min-w-0 flex-1 text-success">
          Finalizado el {job.finishedAt ? dayMonthNum(job.finishedAt) : "—"} por {job.finishedBy?.name ?? "—"} · el cliente aprobó la versión final.
        </p>
        {money.pending > 0 && (
          <>
            <span className="text-warning">Queda pendiente {formatMoney(money.pending)}</span>
            <Button size="sm" onClick={() => openPayment(job.id)}>
              Registrar pago
            </Button>
          </>
        )}
      </div>
    );
  if (s === "correcciones" && corr)
    return (
      <div className="enter rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-[13px]">
        <p className="text-warning">
          Corrección {Math.min(job.correctionRounds, 2)} de 2{corr.charge === "error_estudio" && " · error del estudio"}
        </p>
        <p className="mt-0.5">{corr.request}</p>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {corr.previousDueAt && corr.newDueAt && dayKey(corr.previousDueAt) !== dayKey(corr.newDueAt) ? `entrega movida ${dayMonthNum(corr.previousDueAt)} → ${dayMonthNum(corr.newDueAt)} · ` : ""}
          {corr.receivedBy?.name ?? "—"}, {timeAgo(corr.createdAt)}
        </p>
      </div>
    );
  if (s === "terminado")
    return (
      <p className="enter rounded-lg border border-info-line bg-info-soft px-4 py-2.5 text-[13px]">
        Listo para enviar. Mándale el avance o la versión final por WhatsApp y marca <b className="font-medium">Enviado al cliente</b>.
      </p>
    );
  if (s === "en_revision")
    return (
      <p className="enter flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info-line bg-info-soft px-4 py-2.5 text-[13px]">
        <span>
          Esperando al cliente. Si pide cambios, <b className="font-medium">Pidió correcciones</b> lo devuelve a Correcciones. Si lo aprueba, <b className="font-medium">Finalizar</b>.
        </span>
        {job.sentAt && <span className="font-mono text-[11px] text-muted">enviado {timeAgo(job.sentAt)}</span>}
      </p>
    );
  if (money.state === "de_mas") {
    const over = round2(money.paid - money.total);
    return (
      <div className="enter flex flex-wrap items-center gap-3 rounded-lg border border-warning-line bg-warning-soft px-4 py-2.5 text-[13px]">
        <p className="min-w-0 flex-1">
          <span className="text-warning">Precio cambiado.</span> Se pagó <b className="font-medium">{formatMoney(over)} de más</b>: regístralo como devolución.
        </p>
        {(!["finalizado", "cancelado"].includes(job.status) || me.isAdmin) && (
          <Button size="sm" variant="danger" onClick={() => openRefund({ jobId: job.id, amount: over, reason: "pago_de_mas" })}>
            Devolver {formatMoney(over)}
          </Button>
        )}
      </div>
    );
  }
  return null;
}

/* ---------- Pasos del estado: nodos con check (RF-61) ---------- */

function StatusSteps({ job, history }: { job: JobJSON; history: HistoryEntry[] }) {
  const s = job.status === "cancelado" ? (job.cancelledFromStatus ?? "confirmado") : job.status;
  const cur = s === "correcciones" ? STATUS_STEPS.indexOf("en_proceso") : STATUS_STEPS.indexOf(s);
  const findHist = (needle: string) => history.find((h) => h.summary?.includes(needle))?.createdAt;
  const dates: Record<string, string | null | undefined> = {
    cotizacion: job.createdAt,
    confirmado: findHist("confirmó la cotización") ?? job.createdAt,
    en_proceso: job.takenAt,
    terminado: findHist("lo marcó terminado") ?? findHist("terminó la corrección"),
    en_revision: job.sentAt,
    finalizado: job.finishedAt,
  };
  const nextStep = STATUS_STEPS[cur + 1];
  return (
    <>
    {/* Celular: una barrita por paso (Celular · ficha). */}
    <div className={cn("md:hidden", job.status === "cancelado" && "opacity-60")}>
      <div className="flex gap-1">
        {STATUS_STEPS.map((step, i) => (
          <span key={step} className={cn("h-1 flex-1 rounded-sm", i < cur || job.status === "finalizado" ? (job.status === "finalizado" ? "bg-success" : "bg-fg") : i === cur ? "bg-info" : "bg-border")} />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between text-xs text-muted">
        <span>
          <span className="text-fg">{job.status === "correcciones" ? `Correcciones ${Math.min(job.correctionRounds, 2)} de 2` : STATUS_LABEL[job.status]}</span> · desde {dayMonth(job.statusChangedAt)}
        </span>
        {nextStep && job.status !== "cancelado" && job.status !== "finalizado" && <span className="font-mono text-[11px]">Sigue: {STATUS_LABEL[nextStep].replace(" por el cliente", "")}</span>}
      </p>
    </div>
    <ol aria-label="Estado del trabajo" className={cn("hidden md:flex", job.status === "cancelado" || job.status === "finalizado" ? "opacity-60" : "")}>
      {STATUS_STEPS.map((step, i) => {
        const done = i < cur || (job.status === "finalizado" && i === cur);
        const current = i === cur && job.status !== "finalizado";
        const last = i === STATUS_STEPS.length - 1;
        const label = step === "en_proceso" && job.status === "correcciones" ? `Correcciones ${Math.min(job.correctionRounds, 2)} de 2` : STATUS_LABEL[step];
        const fin = job.status === "finalizado" && step === "finalizado";
        return (
          <li key={step} className={cn("flex min-w-0 flex-col gap-[7px]", last ? "flex-none items-end" : "flex-1")}>
            <span className="flex w-full items-center">
              {done ? (
                <span className={cn("step-pop grid size-4 shrink-0 place-items-center rounded-full", fin ? "bg-success" : "bg-fg")} style={{ "--i": i } as React.CSSProperties}>
                  <Check className="size-2.5 text-bg" strokeWidth={3.5} />
                </span>
              ) : current ? (
                <span className="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-info">
                  <span className="size-1.5 rounded-full bg-info" />
                </span>
              ) : (
                <span className="size-4 shrink-0 rounded-full border border-border-strong" />
              )}
              {!last && <span className={cn("mx-1.5 h-px flex-1", i < cur ? "bg-fg" : "bg-border")} />}
            </span>
            <span className={cn("text-xs leading-tight", current ? "text-fg" : done ? (fin ? "text-success" : "text-muted") : "text-faint", step === "en_revision" && "max-w-20")}>{label}</span>
            <span className="h-3 font-mono text-[10.5px] text-faint">
              {current && dates[step] ? `desde ${dayMonth(job.statusChangedAt)}` : done && dates[step] ? dayMonth(dates[step]!) : current ? `desde ${dayMonth(job.statusChangedAt)}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
    </>
  );
}

/* ---------- Resumen ---------- */

function Cell({ label, children, className, opt }: { label: string; children: ReactNode; className?: string; opt?: boolean }) {
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <p className="font-mono text-[11px] text-muted">
        {label}
        {opt && <span className="text-faint"> · opcional</span>}
      </p>
      <div className="mt-1 truncate text-sm">{children}</div>
    </div>
  );
}

function InlineAdd({ jobId, field, value, disabled }: { jobId: string; field: "course" | "professor"; value: string | null; disabled: boolean }) {
  const { run } = useAct();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value ?? "");
  if (edit)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setEdit(false);
          run(() => setJobField(jobId, field, v));
        }}
        className="flex gap-1"
      >
        <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={() => setEdit(false)} className="h-7 min-w-0 flex-1 rounded border bg-bg px-2 text-sm outline-none" aria-label={field} />
      </form>
    );
  if (value) return <span>{value}</span>;
  return (
    <span className="text-faint">
      Sin indicar{" "}
      {!disabled && (
        <button type="button" onClick={() => setEdit(true)} className="ml-1.5 text-xs text-info">
          + Agregar
        </button>
      )}
    </span>
  );
}

function DataGrid({ job, me, late, closed, factor }: { job: JobJSON; me: Me; late: boolean; closed: boolean; factor: number | null }) {
  const today = dayKey(job.dueAt) === todayLima();
  const moved = job.originalDueAt && dayKey(job.originalDueAt) !== dayKey(job.dueAt);
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-surface md:grid-cols-4 [&>*]:border-line [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+3)]:border-t-0 md:[&>*:nth-child(n+5)]:border-t [&>*:nth-child(odd)]:border-r md:[&>*:not(:nth-child(4n))]:border-r">
      <Cell label="Entrega">
        <span className={late ? "text-danger" : today ? "text-warning" : ""}>
          {["Hoy", "Mañana"].includes(dueLabel(job.dueAt)) ? `${dueLabel(job.dueAt)} · ${weekdayShort(job.dueAt).toLowerCase()}` : weekdayShort(job.dueAt)} {dayMonthNum(job.dueAt)}
        </span>
        {moved && <span className="ml-1.5 text-xs text-faint">antes <span className="line-through">{dayMonthNum(job.originalDueAt!)}</span></span>}
      </Cell>
      <Cell label="Responsable">
        {job.externo ? (
          <span>
            Externo · {job.externo.name} <span className="text-xs text-faint">· sin acceso</span>
          </span>
        ) : job.responsible ? (
          <span>{job.responsible.id === me.id ? `Tú · ${job.responsible.name}` : job.responsible.name}</span>
        ) : job.status === "cotizacion" ? (
          <span className="text-faint">Cuando se confirme</span>
        ) : (
          <span className="text-warning">Por tomar</span>
        )}
      </Cell>
      <Cell label="WhatsApp">
        <a href={`https://wa.me/51${job.client.whatsapp}`} target="_blank" rel="noreferrer" className="hover-fine:hover:underline">
          {formatPhone(job.client.whatsapp)}
        </a>
      </Cell>
      <Cell label="Registrado">
        {dayMonth(job.createdAt)} · {job.createdBy?.name ?? "—"}
      </Cell>
      <Cell label="Curso" opt>
        <InlineAdd jobId={job.id} field="course" value={job.course} disabled={closed && !me.isAdmin} />
      </Cell>
      <Cell label="Profesor" opt>
        <InlineAdd jobId={job.id} field="professor" value={job.professor} disabled={closed && !me.isAdmin} />
      </Cell>
      <Cell label="Ciclo de la carrera">
        {job.cycle} {factor && factor !== 1 && <span className="ml-1 font-mono text-xs text-muted">×{factor.toFixed(2)}</span>}
      </Cell>
      <Cell label="Correcciones">
        {job.correctionRounds} <span className="text-muted">de 2 incluidas</span>
      </Cell>
    </div>
  );
}

function ItemsSection({ job, me, closed, onSummary, onEdit }: { job: JobJSON; me: Me; closed: boolean; onSummary: () => void; onEdit: () => void }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    job.items.map((i) => ({ id: i.id, done: !!i.doneAt })),
    (state, patch: { id: string; done: boolean }) => state.map((s) => (s.id === patch.id ? { ...s, done: patch.done } : s)),
  );
  const doneCount = optimistic.filter((i) => i.done).length;
  const canCheck = !closed && (job.responsibleId === me.id || !!job.externoId || me.isAdmin) && job.status !== "cotizacion";
  const hours = round2(job.items.reduce((a, i) => a + i.hours, 0));

  const toggle = (id: string, done: boolean) =>
    start(async () => {
      setOptimistic({ id, done });
      const r = await toggleItem(id, done);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-3 text-[15px] font-medium">
          Lo que se cobra
          <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-normal text-muted">
            <span className="inline-flex gap-1">
              {optimistic.map((i) => (
                <span key={i.id} className={cn("size-2.5 rounded-[3px] transition-colors duration-200", i.done ? "bg-fg" : "border border-border-strong")} />
              ))}
            </span>
            {doneCount} de {optimistic.length}
          </span>
        </h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSummary}>
            <FileText /> Resumen para el cliente
          </Button>
          {(!closed || me.isAdmin) && (
            <Button size="sm" variant="ghost" className="border" onClick={onEdit}>
              Editar ítems
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-surface">
        {job.items.map((it, idx) => {
          const done = optimistic.find((o) => o.id === it.id)?.done ?? false;
          const who = it.doneByExterno?.name ?? it.doneBy?.name;
          return (
            <div key={it.id} className={cn("grid min-h-11 grid-cols-[22px_48px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 md:grid-cols-[22px_54px_minmax(0,1fr)_90px_120px_44px_90px]", idx > 0 && "border-t border-line")}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`${done ? "Desmarcar" : "Marcar hecho"} ${it.code}`}
                disabled={!canCheck}
                onClick={() => toggle(it.id, !done)}
                className={cn(
                  "check grid size-[18px] place-items-center rounded-[5px] border transition-[background-color,border-color] duration-150 disabled:cursor-default",
                  done ? "border-fg bg-fg" : "border-border-strong hover-fine:enabled:hover:border-muted",
                )}
              >
                {done && <Check className="check-mark size-3 text-bg" strokeWidth={3} />}
              </button>
              <span className={cn("font-mono text-xs", done ? "text-faint" : "text-muted")}>{it.code}</span>
              <span className={cn("min-w-0 truncate text-sm transition-colors duration-200", done && "text-faint line-through decoration-faint")}>
                {it.categoryCode === "OT" ? (it.detail ?? it.name) : it.name}
              </span>
              <span className="text-right font-mono text-[13px] md:hidden">{formatMoney(it.amount)}</span>
              <span className="hidden truncate text-[13px] text-faint md:block">
                {it.quantity} {it.unit?.replace(/^por\s+/, "")}
                {it.quantity !== 1 && "s"}
              </span>
              <span className="hidden md:block">
                {done && who ? (
                  <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                    <span className="grid size-[22px] place-items-center rounded-full border border-border-strong bg-bg font-mono text-[9.5px] text-fg">{initials(who)}</span>
                    {it.doneAt && dayMonth(it.doneAt)}
                  </span>
                ) : !done && !["cotizacion", "cancelado", "finalizado"].includes(job.status) ? (
                  <span className="text-xs text-warning">falta</span>
                ) : null}
              </span>
              <span className="hidden font-mono text-xs text-faint md:block">{it.hours} h</span>
              <span className={cn("hidden text-right font-mono text-sm md:block", done && "text-faint")}>{formatMoney(it.amount)}</span>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[13px] text-muted">
          <span>
            ≈ <span className="font-mono text-fg">{hours} h</span> de trabajo
          </span>
          <span>
            {job.urgency === "normal" ? "Normal" : job.urgency === "alta" ? "Alta" : "Urgente"} <span className={cn("font-mono", job.urgencyPct ? "text-danger" : "text-fg")}>+{job.urgencyPct} %</span>
          </span>
          <span>
            Adicional <span className="font-mono text-fg">{formatMoney(job.complexityExtra)}</span>
          </span>
          {job.discount > 0 && (
            <span>
              Descuento <span className="font-mono text-fg">− {formatMoney(job.discount)}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function ExtrasSection({ job }: { job: JobJSON }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-baseline gap-3 text-[15px] font-medium">
        Extras aparte del precio pactado <span className="text-xs font-normal text-faint">El precio original no se toca</span>
      </h3>
      <div className="overflow-hidden rounded-lg border bg-surface">
        {job.extras.map((e, i) => {
          const corr = job.corrections.find((c) => c.id === e.correctionId);
          const pay = job.payments.find((p) => p.correctionId === e.correctionId && !p.voidedAt);
          return (
            <div key={e.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]", i > 0 && "border-t border-line")}>
              {corr && <span className="text-warning">Corrección {corr.number}</span>}
              <span className="min-w-0 flex-1 truncate">{e.reason.replace(/^Corrección \d+ · /, "")}</span>
              <span className="text-xs text-muted">
                {e.createdBy?.name ?? "—"} · {dayMonthNum(e.createdAt)} {timeLima(e.createdAt)}
              </span>
              <span className={cn("text-xs", pay ? "text-success" : "text-warning")}>{pay ? `Pagado · ${METHOD_LABEL[pay.method]}` : "Pendiente"}</span>
              <span className="w-24 text-right font-mono">{formatMoney(e.amount)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PaymentsSection({ job, me, money }: { job: JobJSON; me: Me; money: Money }) {
  const { openPayment, openRefund } = useJobDialogs();
  const [voiding, setVoiding] = useState<{ id: string; amount: number; label: string } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const closed = job.status === "finalizado" || job.status === "cancelado";
  const dot = { sin_pagar: "bg-danger", adelanto: "bg-warning", pagado: "bg-success", de_mas: "bg-warning" }[money.state];
  const cancelled = job.status === "cancelado";
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-medium">
          Pagos
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs font-normal">
            <span className={cn("size-1.5 rounded-full", dot)} />
            {PAY_STATE_LABEL[money.state]}
          </span>
        </h3>
        <div className="flex gap-2">
          {(!closed || me.isAdmin) && money.paid > 0 && (
            <Button size="sm" variant="danger" onClick={() => openRefund({ jobId: job.id })}>
              Devolución
            </Button>
          )}
          {!cancelled && (
            <Button size="sm" onClick={() => openPayment(job.id)}>
              Registrar pago
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left font-mono text-[11px] text-muted">
              <th className="px-4 py-2.5 font-normal">Fecha</th>
              <th className="px-4 py-2.5 font-normal">Medio · operación</th>
              <th className="px-4 py-2.5 font-normal">Registró</th>
              <th className="px-4 py-2.5 text-right font-normal">Monto</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {job.payments.length === 0 && (
              <tr className="border-t border-line">
                <td colSpan={5} className="px-4 py-4 text-center text-[13px] text-faint">
                  {job.status === "cotizacion" ? "Sin pagos: es una cotización." : "Aún no hay pagos."}
                </td>
              </tr>
            )}
            {job.payments.map((p) => (
              <PaymentRow
                key={p.id}
                p={p}
                me={me}
                menuOpen={menu === p.id}
                setMenu={(v) => setMenu(v ? p.id : null)}
                onVoid={() => setVoiding({ id: p.id, amount: p.amount, label: p.kind === "devolucion" ? "Devolución" : "Pago" })}
              />
            ))}
            <tr className="border-t">
              <td colSpan={5} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-1 text-[13px] text-muted">
                  {money.extras > 0 ? (
                    <span>
                      Precio pactado <span className="ml-1.5 font-mono text-fg">{formatMoney(job.price)}</span>
                      <span className="mx-2 text-faint">+</span>Extras <span className="ml-1 font-mono text-warning">{formatMoney(money.extras)}</span>
                      <span className="mx-2 text-faint">=</span>Total <span className="ml-1 font-mono text-fg">{formatMoney(money.total)}</span>
                    </span>
                  ) : (
                    <span>
                      Precio <span className="ml-1.5 font-mono text-fg">{formatMoney(money.total)}</span>
                    </span>
                  )}
                  <span>
                    Pagado <span className="ml-1.5 font-mono text-fg">{formatMoney(money.paid)}</span>
                  </span>
                  {money.state === "de_mas" ? (
                    <span>
                      Pagado de más <span className="ml-1.5 font-mono text-lg text-warning">{formatMoney(round2(money.paid - money.total))}</span>
                    </span>
                  ) : (
                    <span>
                      Pendiente{" "}
                      {cancelled ? (
                        <>
                          <span className="ml-1.5 font-mono text-lg text-faint line-through">{formatMoney(Math.max(0, money.total - money.paid))}</span> <span className="text-faint">no se cobra</span>
                        </>
                      ) : (
                        <span className={cn("ml-1.5 font-mono text-lg", money.pending > 0 ? "text-warning" : "text-success")}>{formatMoney(money.pending)}</span>
                      )}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} />
    </section>
  );
}

function PaymentRow({ p, me, menuOpen, setMenu, onVoid }: { p: JobJSON["payments"][number]; me: Me; menuOpen: boolean; setMenu: (v: boolean) => void; onVoid: () => void }) {
  const voided = !!p.voidedAt;
  const refund = p.kind === "devolucion";
  return (
    <>
      <tr className={cn("border-t border-line text-sm", voided && "text-faint line-through")}>
        <td className="px-4 py-[11px] font-mono text-[13px] text-muted">{dayMonthNum(p.paidAt)}/{p.paidAt.slice(0, 4)}</td>
        <td className="px-4 py-[11px]">
          {METHOD_LABEL[p.method]}
          {p.operationNumber && ` · ${p.operationNumber}`}
          {p.label && p.label !== "Pago" && <span className={cn("ml-2 text-xs", refund ? "text-danger" : p.label.startsWith("extra") ? "text-warning" : "text-faint")}>{p.label.toLowerCase()}</span>}
        </td>
        <td className="px-4 py-[11px] text-muted">{p.createdBy?.name ?? "—"}</td>
        <td className={cn("px-4 py-[11px] text-right font-mono", refund && !voided && "text-danger")}>
          {refund ? "− " : ""}
          {formatMoney(p.amount)}
        </td>
        <td className="relative px-2">
          {me.isAdmin && !voided && (
            <>
              <button type="button" aria-label="Más acciones del pago" onClick={() => setMenu(!menuOpen)} className="press grid size-7 place-items-center rounded text-muted hover-fine:hover:bg-hover">
                <MoreHorizontal className="size-4" />
              </button>
              {menuOpen && (
                <div className="pop-in absolute top-9 right-2 z-10 w-44 overflow-hidden rounded-md border bg-surface py-1 text-[13px] shadow-[0_12px_32px_rgba(0,0,0,0.35)]" style={{ transformOrigin: "top right" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      onVoid();
                    }}
                    className="row w-full px-3 py-2 text-left text-danger"
                  >
                    Anular {refund ? "devolución" : "pago"}
                  </button>
                </div>
              )}
            </>
          )}
        </td>
      </tr>
      {voided && (
        <tr>
          <td colSpan={5} className="px-4 pb-2.5">
            <span className="inline-block rounded bg-danger-soft px-2 py-1 text-xs text-danger">
              Anulado por {p.voidedBy?.name ?? "—"} · {p.voidedAt && dayMonthNum(p.voidedAt)} · «{p.voidReason}»
            </span>
            <span className="ml-2 text-xs text-faint">No suma a lo pagado; lo pendiente vuelve a subir.</span>
          </td>
        </tr>
      )}
      {refund && p.reason && !voided && (
        <tr>
          <td colSpan={5} className="px-4 pb-2.5 text-xs text-muted">
            {p.reason}
          </td>
        </tr>
      )}
    </>
  );
}

function RelatedSection({ job }: { job: JobJSON }) {
  const links: { label: string; code: string; title: string }[] = [];
  if (job.continues) links.push({ label: job.status === "cancelado" ? "Retoma" : "Continúa", code: job.continues.code, title: job.continues.title });
  for (const c of job.continuedBy) links.push({ label: "Siguió en", code: c.code, title: c.title });
  if (job.parent) links.push({ label: "Relacionado con", code: job.parent.code, title: job.parent.title });
  for (const c of job.children) links.push({ label: "Relacionado", code: c.code, title: c.title });
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link key={l.code + l.label} href={`/trabajos/${l.code}`} className="press inline-flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-[13px] hover-fine:hover:border-border-strong">
          <span className="text-muted">{l.label}</span>
          <span className="font-mono">{l.code}</span>
          <span className="max-w-60 truncate text-muted">{l.title}</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- Archivos (RF-24, RF-25, RF-31) ---------- */

function FilesTab({ job, me, driveReady }: { job: JobJSON; me: Me; driveReady: boolean }) {
  const folders = [
    { key: "recibido", n: "01", name: "Recibido", hint: "lo que mandó el cliente" },
    { key: "avances", n: "02", name: "Avances", hint: "" },
    { key: "entrega_final", n: "03", name: "Entrega final", hint: "" },
  ] as const;
  return (
    <div className="enter flex flex-col gap-4">
      {!driveReady ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-[13px]">
          <FolderOpen className="mt-0.5 size-4 text-warning" />
          <p className="min-w-0 flex-1">
            <b className="font-medium">Drive todavía no está conectado.</b>
            <span className="block text-muted">
              Cuando {me.isAdmin ? "lo conectes" : "el admin lo conecte"} en Configuración, este trabajo tendrá su carpeta {job.code} con Recibido, Avances y Entrega final.
            </span>
          </p>
          {me.isAdmin && (
            <Button size="sm" asChild>
              <Link href="/configuracion">Conectar Drive</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3">
          <div>
            <p className="font-mono text-[11px] text-muted">Carpeta en Drive</p>
            <p className="text-sm">
              {job.code} - {job.client.name} - {job.title.slice(0, 32)}
            </p>
          </div>
          {job.driveFolderId && (
            <Button size="sm" asChild>
              <a href={`https://drive.google.com/drive/folders/${job.driveFolderId}`} target="_blank" rel="noreferrer">
                <FolderOpen /> Abrir en Drive
              </a>
            </Button>
          )}
        </div>
      )}
      {folders.map((f) => {
        const files = job.files.filter((x) => x.folder === f.key);
        return (
          <section key={f.key} className={cn(!driveReady && "opacity-60")}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-baseline gap-2 text-sm font-medium">
                <span className="font-mono text-[11px] font-normal text-faint">{f.n}</span>
                {f.name}
                <span className="font-mono text-[11px] font-normal text-muted">{files.length}</span>
                {f.hint && <span className="text-xs font-normal text-faint">{f.hint}</span>}
              </h3>
            </div>
            {files.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-4 text-center text-xs text-faint">{driveReady ? `Arrastra aquí ${f.key === "entrega_final" ? "la entrega final" : "los archivos"} o usa Subir aquí` : "Sin carpeta"}</p>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-surface">
                {files.map((x, i) => (
                  <a key={x.id} href={x.webViewLink ?? "#"} target="_blank" rel="noreferrer" className={cn("row flex items-center gap-3 px-4 py-2.5 text-[13px]", i > 0 && "border-t border-line")}>
                    <span className="w-10 font-mono text-[10px] text-muted">{x.name.split(".").pop()?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate">{x.name}</span>
                    <span className="text-xs text-faint">
                      {x.uploadedBy?.name ?? "—"} · {dayMonth(x.createdAt)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-faint">Arrastra archivos sobre cualquier sección para subirlos a esa carpeta. Borrar archivos solo lo puede hacer el administrador.</p>
    </div>
  );
}

/* ---------- Notas (RF-44, RF-67) ---------- */

function NotesTab({ job, lastSeen, meId }: { job: JobJSON; lastSeen: string | null; meId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await addNote({ jobId: job.id, body });
      if (!r.ok) return void toast.error(r.error);
      setBody("");
      router.refresh();
    });
  return (
    <div className="enter flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Apuntes de quienes toman el trabajo. Lo que pide el cliente va por <b className="font-medium text-fg-2">Corrección</b>, no aquí.
      </p>
      <div className="flex flex-col gap-2">
        {job.notes.length === 0 && <p className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-faint">Todavía no hay apuntes.</p>}
        {job.notes.map((n) => {
          const isNew = n.author?.id !== meId && (!lastSeen || n.createdAt > lastSeen);
          return (
            <div key={n.id} className={cn("flex gap-3 rounded-lg border px-4 py-3", isNew ? "border-warning-line bg-warning-soft" : "bg-surface")}>
              <Avatar name={n.author?.name} className="mt-0.5 size-7" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <b className="font-medium">{n.author?.name ?? "—"}</b>
                  <span className="font-mono text-[11px] text-faint">
                    {dayMonthNum(n.createdAt)} {timeLima(n.createdAt)}
                  </span>
                  <span className={cn("text-xs", n.isHandoff ? "text-warning" : "text-faint")}>{n.isHandoff ? "soltó el trabajo" : "apunte"}</span>
                  {isNew && <span className="rounded-full bg-warning px-1.5 text-[10.5px] font-medium text-bg">nueva</span>}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border bg-surface p-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un apunte para quien siga con este trabajo…" className="min-h-16 border-0 bg-transparent p-0 focus:border-0" />
        <div className="flex justify-end">
          <Button size="sm" variant="primary" onClick={save} disabled={pending || body.trim().length < 2}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Historial (RF-21) ---------- */

function HistoryTab({ history }: { history: HistoryEntry[] }) {
  return (
    <div className="enter overflow-hidden rounded-lg border bg-surface">
      {history.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-faint">Sin cambios registrados.</p>}
      {history.map((h, i) => (
        <div key={h.id} className={cn("grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[13px] md:grid-cols-[130px_160px_minmax(0,1fr)]", i > 0 && "border-t border-line")}>
          <span className="font-mono text-[11.5px] text-muted">
            {dayMonthNum(h.createdAt)} {timeLima(h.createdAt)}
          </span>
          <span className="hidden truncate md:block">{h.userName ?? "Sistema"}</span>
          <span className="min-w-0 text-fg-2">
            <span className="md:hidden">{h.userName ?? "Sistema"} </span>
            {h.summary ?? h.action}
          </span>
        </div>
      ))}
    </div>
  );
}
