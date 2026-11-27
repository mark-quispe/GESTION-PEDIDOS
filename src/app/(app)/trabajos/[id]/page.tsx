import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { ExternalLink, FolderOpen, Pencil, Plus } from "lucide-react";
import { db } from "@/db";
import { auditLog, jobFiles, jobNotes, jobs, payments, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { actionLabel, auditDetail } from "@/lib/audit-format";
import { todayLima } from "@/lib/dates";
import { FOLDER_LABELS, STATUS_HINTS, balance, formatWhatsapp, isLate, paymentStatus } from "@/lib/domain";
import { driveState, folderExists, folderUrl, getSettings, DriveError } from "@/lib/drive";
import { jobGroup } from "@/lib/queries";
import { formatBytes, formatDateTime, formatDay, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LateBadge, PaymentBadge, StatusBadge, UrgencyBadge } from "@/components/jobs/badges";
import { StatusSelect } from "@/components/jobs/jobs-browser";
import { FileUploader } from "@/components/jobs/file-uploader";
import { CreateFolderButton, DeleteFileButton, DeleteJobButton, NoteForm, PaymentsPanel, type PaymentRow } from "@/components/jobs/job-panels";

export async function generateMetadata({ params }: PageProps<"/trabajos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = /^[0-9a-f-]{36}$/.test(id) ? await db.query.jobs.findFirst({ where: eq(jobs.id, id), columns: { code: true } }) : null;
  return { title: job?.code ?? "Trabajo" };
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-mono text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

async function folderStatus(driveFolderId: string | null) {
  try {
    return (await folderExists(driveFolderId)) ? "ok" : "falta";
  } catch (e) {
    return e instanceof DriveError ? "error" : "error";
  }
}

export default async function JobPage({ params, searchParams }: PageProps<"/trabajos/[id]">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, id), isNull(jobs.deletedAt)),
    with: {
      client: true,
      serviceType: true,
      responsable: true,
      createdBy: { columns: { name: true, email: true } },
      parent: { columns: { id: true, code: true, description: true } },
    },
  });
  if (!job) notFound();
  const today = todayLima();
  const rootId = job.parentJobId ?? job.id;

  const [paymentRows, notes, files, group, history, settings] = await Promise.all([
    db
      .select({ p: payments, who: users.name, whoEmail: users.email })
      .from(payments)
      .leftJoin(users, eq(users.id, payments.createdById))
      .where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt)),
    db.query.jobNotes.findMany({ where: eq(jobNotes.jobId, job.id), orderBy: desc(jobNotes.createdAt), with: { author: { columns: { name: true, email: true } } } }),
    db.query.jobFiles.findMany({
      where: and(eq(jobFiles.jobId, job.id), isNull(jobFiles.deletedAt)),
      orderBy: desc(jobFiles.createdAt),
      with: { uploadedBy: { columns: { name: true, email: true } } },
    }),
    jobGroup(rootId),
    db
      .select({ a: auditLog, who: users.name, whoEmail: users.email })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(or(eq(auditLog.jobId, job.id), and(eq(auditLog.entity, "trabajo"), eq(auditLog.entityId, job.id))))
      .orderBy(desc(auditLog.createdAt))
      .limit(200),
    getSettings(),
  ]);

  // RF-21: cada pago muestra quién lo registró y, si fue corregido, el valor anterior y el nuevo.
  const paymentIds = paymentRows.map((r) => r.p.id);
  const corrections = paymentIds.length
    ? await db
        .select({ a: auditLog, who: users.name, whoEmail: users.email })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(and(eq(auditLog.entity, "pago"), eq(auditLog.action, "corregir"), inArray(auditLog.entityId, paymentIds)))
        .orderBy(asc(auditLog.createdAt))
    : [];
  const rows: PaymentRow[] = paymentRows.map(({ p, who, whoEmail }) => ({
    id: p.id,
    kind: p.kind,
    amount: p.amount,
    paidOn: p.paidOn,
    method: p.method,
    operationNumber: p.operationNumber,
    reason: p.reason,
    receiptLink: p.receiptLink,
    createdBy: who ?? whoEmail ?? "—",
    createdAt: p.createdAt.toISOString(),
    corrections: corrections
      .filter((c) => c.a.entityId === p.id)
      .map((c) => ({ at: c.a.createdAt.toISOString(), by: c.who ?? c.whoEmail ?? "—", before: (c.a.before ?? {}) as Record<string, unknown>, after: (c.a.after ?? {}) as Record<string, unknown> })),
  }));

  const paid = rows.reduce((s, r) => s + (r.kind === "pago" ? 1 : -1) * Number(r.amount), 0);
  const owed = job.status === "cancelado" ? 0 : balance(job.price, paid);
  const late = isLate(job.status, job.dueDate, today);
  const drive = driveState(settings);
  const folder = drive === "conectado" && job.driveFolderId ? await folderStatus(job.driveFolderId) : null;
  const related = group.filter((g) => g.id !== job.id && g.id !== job.parentJobId);
  const groupPrice = group.reduce((s, g) => s + Number(g.price ?? 0), 0);
  const groupPaid = group.reduce((s, g) => s + Number(g.paid), 0);
  const groupBalance = group.reduce((s, g) => s + g.balance, 0);

  return (
    <>
      <div className="mb-8 grid gap-4 border-b pb-6">
        <p className="font-mono text-xs text-muted-foreground">
          <Link href="/trabajos" className="hover:text-foreground">
            Trabajos
          </Link>{" "}
          / {job.serviceType.name}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-baseline gap-x-3 text-3xl font-medium">
              <span className="font-mono tracking-tight">{job.code}</span>
              <Link href={`/clientes/${job.client.id}`} className="text-xl text-muted-foreground transition-colors hover:text-foreground">
                {job.client.name}
              </Link>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusSelect key={job.status} id={job.id} code={job.code} status={job.status} />
              {late && <LateBadge />}
              <UrgencyBadge urgency={job.urgency} />
              {job.price !== null && job.status !== "cancelado" && <PaymentBadge status={paymentStatus(job.price, paid)} />}
              <span className="text-xs text-muted-foreground">{STATUS_HINTS[job.status]}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/trabajos/nuevo?cliente=${job.client.id}&relacionado=${rootId}`}>
                <Plus /> Trabajo relacionado
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/trabajos/${job.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
            {isAdmin && <DeleteJobButton id={job.id} code={job.code} />}
          </div>
        </div>
        {typeof aviso === "string" && (
          <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            El trabajo se creó, pero {aviso.charAt(0).toLowerCase() + aviso.slice(1)}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Section title="Pedido">
            <p className="mb-5 text-sm whitespace-pre-line">{job.description}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Item label="Curso">{job.course}</Item>
              <Item label="Profesor">{job.professor}</Item>
              <Item label="Sección · ciclo">{[job.section, job.academicTerm].filter(Boolean).join(" · ")}</Item>
              <Item label="Entrega">
                <span className={late ? "text-danger" : undefined}>{formatDay(job.dueDate, { weekday: "long", day: "numeric", month: "long" })}</span>
              </Item>
              <Item label="Responsable">{job.responsable?.name}</Item>
              <Item label="Correcciones">{String(job.correctionsCount)}</Item>
              <Item label="Universidad">{job.client.university}</Item>
              <Item label="WhatsApp">
                <a href={`https://wa.me/${job.client.whatsapp}`} target="_blank" rel="noreferrer" className="font-mono text-xs underline-offset-4 hover:underline">
                  {formatWhatsapp(job.client.whatsapp)}
                </a>
              </Item>
              <Item label="Registrado">
                {job.createdBy?.name ?? job.createdBy?.email ?? "—"} · {formatDateTime(job.createdAt)}
                {job.origin !== "sistema" && <span className="text-muted-foreground"> · desde {job.origin}</span>}
              </Item>
            </dl>
            {job.client.observations && (
              <p className="mt-5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                <span className="font-medium text-warning">Observaciones del cliente: </span>
                {job.client.observations}
              </p>
            )}
          </Section>

          <Section
            title="Archivos"
            aside={
              folder === "ok" && job.driveFolderId ? (
                <a href={folderUrl(job.driveFolderId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <FolderOpen className="size-3.5" /> Abrir carpeta en Drive
                </a>
              ) : null
            }
          >
            <div className="grid gap-4">
              {drive === "sin_conectar" || drive === "sin_carpeta" ? (
                <p className="text-sm text-muted-foreground">Drive todavía no está conectado. {isAdmin ? <Link href="/admin/configuracion" className="underline underline-offset-4">Conectarlo</Link> : "Pídeselo al admin."}</p>
              ) : drive === "desconectado" ? (
                <p className="text-sm text-danger">Drive desconectado, vuelve a conectarlo. {isAdmin && <Link href="/admin/configuracion" className="underline underline-offset-4">Ir a configuración</Link>}</p>
              ) : !job.driveFolderId ? (
                <CreateFolderButton jobId={job.id} />
              ) : folder === "falta" ? (
                <div className="grid gap-2">
                  <p className="text-sm text-warning">La carpeta de este trabajo fue borrada en Drive.</p>
                  <CreateFolderButton jobId={job.id} recreate />
                </div>
              ) : folder === "error" ? (
                <p className="text-sm text-muted-foreground">No se pudo revisar la carpeta en Drive. Recarga la página en un momento.</p>
              ) : (
                <FileUploader jobId={job.id} />
              )}
              {files.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">{FOLDER_LABELS[f.folder]}</span>
                      <span className="min-w-0 flex-1">
                        {f.webViewLink ? (
                          <a href={f.webViewLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate underline-offset-4 hover:underline">
                            <span className="truncate">{f.name}</span>
                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="truncate">{f.name}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {formatBytes(f.size)} · {f.uploadedBy?.name ?? f.uploadedBy?.email ?? "—"} · {formatDateTime(f.createdAt)}
                        </span>
                      </span>
                      {isAdmin && <DeleteFileButton id={f.id} name={f.name} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Notas internas">
            <div className="grid gap-4">
              <NoteForm jobId={job.id} />
              {notes.length > 0 && (
                <ol className="grid gap-3 border-l pl-4">
                  {notes.map((n) => (
                    <li key={n.id} className="grid gap-0.5">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {formatDateTime(n.createdAt)} · {n.author?.name ?? n.author?.email ?? "—"}
                      </p>
                      <p className="text-sm whitespace-pre-line">{n.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Section>

          {isAdmin && (
            <Section title="Historial de cambios">
              {history.length ? (
                <ol className="grid gap-2 text-sm">
                  {history.map(({ a, who, whoEmail }) => (
                    <li key={a.id} className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                      <span>
                        <span className="font-medium">{who ?? whoEmail ?? "Sistema"}</span> {actionLabel(a.action)}
                        {a.entity !== "trabajo" && ` (${a.entity})`}
                        {a.source !== "sistema" && <span className="text-muted-foreground"> · {a.source}</span>}
                        <span className="block text-xs text-muted-foreground">{auditDetail(a.action, a.before, a.after)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
              )}
            </Section>
          )}
        </div>

        <div className="grid content-start gap-6 max-lg:order-first">
          <Section title="Dinero">
            <dl className="mb-5 grid grid-cols-3 gap-3">
              <Item label="Precio">
                <span className="text-base font-medium tabular-nums">{formatMoney(job.price)}</span>
              </Item>
              <Item label="Pagado">
                <span className="text-base font-medium tabular-nums">{formatMoney(paid)}</span>
              </Item>
              <Item label={owed < 0 ? "A favor" : "Saldo"}>
                <span className={owed > 0 ? "text-base font-medium text-warning tabular-nums" : "text-base font-medium tabular-nums"}>{formatMoney(Math.abs(owed))}</span>
              </Item>
            </dl>
            <PaymentsPanel jobId={job.id} rows={rows} isAdmin={isAdmin} today={today} canAttach={drive === "conectado" && !!job.driveFolderId && folder === "ok"} />
          </Section>

          <Section title={job.parentJobId ? "Trabajo original" : "Trabajos relacionados"}>
            {job.parent && (
              <Link href={`/trabajos/${job.parent.id}`} className="mb-4 block rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                <span className="font-mono text-xs">{job.parent.code}</span>
                <span className="block truncate text-muted-foreground">{job.parent.description}</span>
              </Link>
            )}
            {related.length ? (
              <>
                <ul className="divide-y rounded-md border">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link href={`/trabajos/${r.id}`} className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                        <span className="font-mono text-xs">{r.code}</span>
                        <StatusBadge status={r.status} />
                        <span className="ml-auto text-xs tabular-nums">{formatMoney(r.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {/* RF-39: total cobrado y saldo de todo el grupo */}
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
                  <Item label="Grupo">{formatMoney(groupPrice)}</Item>
                  <Item label="Cobrado">{formatMoney(groupPaid)}</Item>
                  <Item label="Saldo">{formatMoney(groupBalance)}</Item>
                </dl>
              </>
            ) : (
              !job.parent && <p className="text-sm text-muted-foreground">Sin trabajos relacionados. Un avance siguiente o algo nuevo que pidió el profesor va como relacionado, con su propio precio.</p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
