"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, batch } from "@/db";
import {
  clients,
  externos,
  jobCorrections,
  jobCounters,
  jobExtras,
  jobItems,
  jobNotes,
  jobs,
  payments,
  serviceCategories,
  serviceItems,
  users,
  type JobStatus,
} from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole, type CurrentUser } from "@/lib/auth-guard";
import { fail, invalid, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { limaInstant, timeAgo, yearLima } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import {
  academicTermFor,
  computeTotal,
  cycleFactor,
  firstName,
  isClosed,
  jobCode,
  lineAmount,
  paidNet,
  round2,
  STATUS_LABEL,
  URGENCY_LABEL,
} from "@/lib/domain";
import { formatMoney } from "@/lib/utils";
import {
  CANCEL_REASON,
  cancelSchema,
  correctionSchema,
  createJobSchema,
  editJobSchema,
  noteSchema,
  releaseSchema,
  type CancelInput,
  type CorrectionInput,
  type CreateJobInput,
  type EditJobInput,
} from "@/lib/validation/jobs";

const done = () => revalidatePath("/", "layout");

async function loadJob(id: string) {
  const job = await db.query.jobs.findFirst({ where: and(eq(jobs.id, id), isNull(jobs.deletedAt)) });
  if (!job) throw new UserError("Ese trabajo ya no existe.");
  return job;
}

/** RF-48: un trabajo cerrado solo lo edita el admin. */
function assertOpenOrAdmin(user: CurrentUser, status: JobStatus) {
  if (isClosed(status) && !user.isAdmin) throw new UserError("Este trabajo está cerrado: solo el admin puede cambiarlo.");
}

/** Lo que pide el formulario, con los precios que manda el tarifario (nunca los del navegador). */
async function priceLines(
  lines: { serviceItemId: string; quantity: number; detail?: string | null; customPrice?: number; hours?: number; jobItemId?: string }[],
  factor: number,
) {
  const ids = [...new Set(lines.map((l) => l.serviceItemId))];
  const catalog = await db
    .select({ item: serviceItems, cat: serviceCategories })
    .from(serviceItems)
    .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.categoryId))
    .where(inArray(serviceItems.id, ids));
  const byId = new Map(catalog.map((c) => [c.item.id, c]));
  return lines.map((l, i) => {
    const c = byId.get(l.serviceItemId);
    if (!c) throw new UserError("Un ítem ya no está en el tarifario. Vuelve a elegirlo.");
    const custom = c.cat.isCustom;
    const base = custom ? round2(l.customPrice ?? 0) : c.item.basePrice;
    if (custom && base <= 0) throw new UserError("Escribe el precio acordado con el admin para el pedido personalizado.");
    const mode = custom ? ("fijo" as const) : c.item.pricingMode;
    const f = mode === "ciclo" ? factor : 1;
    const hours = custom ? (l.hours ?? 0) : (c.item.hours ?? 0);
    return {
      serviceItemId: c.item.id,
      code: c.item.code,
      categoryCode: c.cat.code,
      prefix: c.cat.prefix,
      isCustom: custom,
      name: c.item.name,
      detail: custom ? (l.detail ?? null) : null,
      unit: c.item.unit,
      pricingMode: mode,
      basePrice: base,
      factor: f,
      quantity: l.quantity,
      hours: round2(hours * l.quantity),
      unitHours: hours,
      amount: lineAmount({ basePrice: base, quantity: l.quantity, pricingMode: mode }, factor),
      sortOrder: i,
    };
  });
}

/** RF-08: correlativo único por año, en una sola sentencia atómica. */
async function nextSeq(year: number, start: number) {
  const [row] = await db
    .insert(jobCounters)
    .values({ year, last: start })
    .onConflictDoUpdate({ target: jobCounters.year, set: { last: sql`${jobCounters.last} + 1` } })
    .returning({ last: jobCounters.last });
  return row.last;
}

/* ---------- Nuevo trabajo (RF-08, RF-57 a RF-60, RF-64, RF-68) ---------- */

export async function createJob(input: CreateJobInput): Promise<ActionResult<{ code: string; id: string }>> {
  try {
    const user = await assertRole();
    const parsed = createJobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    if (v.who === "yo" && !user.canTake) throw new UserError("«Lo hago yo» es solo para quien tiene el rol Producción.");
    const s = await getSettings();

    // Cliente: el elegido o uno nuevo (RF-36: nunca dos con el mismo WhatsApp).
    let clientId = v.clientId ?? null;
    let clientName = "";
    if (!clientId && v.newClient) {
      const existing = await db.query.clients.findFirst({ where: eq(clients.whatsapp, v.newClient.whatsapp) });
      if (existing) {
        clientId = existing.id;
        clientName = existing.name;
      }
    }
    const factor = cycleFactor(s.cycleFactors, v.cycle);
    const lines = await priceLines(v.items, factor);
    const pct = s.urgency[v.urgency].pct;
    const { total, hours } = computeTotal(lines, factor, pct, v.complexityExtra);
    const allCustom = lines.every((l) => l.isCustom);
    const prefix = allCustom ? "OT" : lines.find((l) => !l.isCustom)!.prefix;
    const year = yearLima();
    const seq = await nextSeq(year, s.codeStart);
    const code = jobCode(prefix, year, seq);
    const id = crypto.randomUUID();
    const dueAt = limaInstant(v.dueDate, v.dueTime);

    const confirmed = v.initialStatus === "confirmado";
    const status: JobStatus = !confirmed ? "cotizacion" : v.who === "pozo" ? "confirmado" : "en_proceso";
    if (v.advance && v.advance.amount > total + 0.004) throw new UserError("El adelanto es mayor que el total.");
    // Regla pedida por Mark (27/11): no se confirma sin el 50 % pagado.
    if (confirmed && (v.advance?.amount ?? 0) + 0.004 < round2(total / 2)) throw new UserError(`Para confirmar, el adelanto debe ser al menos el 50 %: ${formatMoney(round2(total / 2))}.`);

    const queries = [];
    if (!clientId && v.newClient) {
      clientId = crypto.randomUUID();
      clientName = v.newClient.name;
      queries.push(
        db.insert(clients).values({ id: clientId, ...v.newClient, software: v.software, usualFormat: v.deliveryFormat, createdById: user.id }),
        audit({ entity: "cliente", entityId: clientId, action: "crear", summary: `registró al cliente ${v.newClient.name}`, userId: user.id }),
      );
    } else if (clientId && !clientName) {
      const c = await db.query.clients.findFirst({ where: eq(clients.id, clientId) });
      if (!c) throw new UserError("El cliente ya no existe.");
      clientName = c.name;
    }

    let university: string | null = null;
    if (clientId && v.clientId) {
      const c = await db.query.clients.findFirst({ where: eq(clients.id, clientId), columns: { university: true } });
      university = c?.university ?? null;
    } else university = v.newClient?.university ?? null;

    queries.push(
      db.insert(jobs).values({
        id,
        code,
        year,
        seq,
        clientId: clientId!,
        title: v.title,
        cycle: v.cycle,
        course: v.course,
        professor: v.professor,
        section: v.section,
        university,
        academicTerm: s.academicTerm || academicTermFor(dueAt),
        software: v.software,
        deliveryFormat: v.deliveryFormat,
        dueAt,
        originalDueAt: dueAt,
        urgency: v.urgency,
        urgencyPct: pct,
        complexityExtra: v.complexityExtra,
        price: total,
        estimatedHours: hours,
        status,
        responsibleId: confirmed && v.who === "yo" ? user.id : null,
        externoId: confirmed && v.who === "externo" ? v.externoId! : null,
        takenAt: confirmed && v.who !== "pozo" ? new Date() : null,
        continuesJobId: v.continuesJobId ?? null,
        createdById: user.id,
      }),
      db.insert(jobItems).values(
        lines.map((l) => ({
          jobId: id,
          serviceItemId: l.serviceItemId,
          code: l.code,
          categoryCode: l.categoryCode,
          name: l.name,
          detail: l.detail,
          unit: l.unit,
          pricingMode: l.pricingMode,
          basePrice: l.basePrice,
          factor: l.factor,
          quantity: l.quantity,
          hours: l.hours,
          amount: l.amount,
          sortOrder: l.sortOrder,
        })),
      ),
      audit({
        entity: "trabajo",
        entityId: id,
        jobId: id,
        action: "crear",
        summary: `creó ${code} como ${STATUS_LABEL[status].toLowerCase()} · ${formatMoney(total)}`,
        after: { status, total, urgency: v.urgency },
        userId: user.id,
      }),
    );
    if (confirmed && v.advance) {
      queries.push(
        db.insert(payments).values({
          jobId: id,
          amount: v.advance.amount,
          method: v.advance.method,
          operationNumber: v.advance.operationNumber,
          label: "Adelanto",
          createdById: user.id,
        }),
        audit({ entity: "pago", entityId: id, jobId: id, action: "pago", summary: `registró el adelanto de ${formatMoney(v.advance.amount)}`, userId: user.id }),
      );
    }
    if (confirmed && v.who === "yo") queries.push(audit({ entity: "trabajo", entityId: id, jobId: id, action: "tomar", summary: "tomó el trabajo al registrarlo", userId: user.id }));
    if (confirmed && v.who === "externo") {
      const ex = await db.query.externos.findFirst({ where: eq(externos.id, v.externoId!) });
      queries.push(audit({ entity: "trabajo", entityId: id, jobId: id, action: "asignar", summary: `lo encargó a ${ex?.name ?? "un externo"} (externo)`, userId: user.id }));
    }
    await batch(queries as [ (typeof queries)[number], ...(typeof queries)[number][] ]);
    done();
    return { ok: true, data: { code, id } };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Tomar y soltar (RF-47, RF-61) ---------- */

export async function takeJob(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole("tomar");
    // Una sola operación: solo funciona si sigue sin responsable (dos personas a la vez).
    const rows = await db
      .update(jobs)
      .set({
        responsibleId: user.id,
        takenAt: new Date(),
        status: sql`case when ${jobs.status} = 'confirmado' then 'en_proceso'::job_status else ${jobs.status} end`,
        statusChangedAt: sql`case when ${jobs.status} = 'confirmado' then now() else ${jobs.statusChangedAt} end`,
      })
      .where(
        and(
          eq(jobs.id, jobId),
          isNull(jobs.responsibleId),
          isNull(jobs.externoId),
          isNull(jobs.deletedAt),
          inArray(jobs.status, ["confirmado", "en_proceso", "correcciones"]),
        ),
      )
      .returning({ id: jobs.id, code: jobs.code });
    if (rows.length === 0) {
      const j = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId), with: { responsible: { columns: { name: true } } } });
      if (j?.responsible) {
        const who = j.responsibleId === user.id ? "Ya es tuyo" : `${firstName(j.responsible.name)} lo tomó ${j.takenAt ? timeAgo(j.takenAt) : "hace un momento"}`;
        throw new UserError(`${who}.`);
      }
      throw new UserError("Este trabajo ya no está por tomar.");
    }
    await audit({ entity: "trabajo", entityId: jobId, jobId, action: "tomar", summary: "tomó el trabajo", userId: user.id });
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Soltar: lo hecho queda a tu nombre, lo que falta vuelve a Por tomar (RF-61). */
export async function releaseJob(input: { jobId: string; note?: string }): Promise<ActionResult> {
  try {
    const user = await assertRole("tomar");
    const v = releaseSchema.parse(input);
    const job = await loadJob(v.jobId);
    if (job.responsibleId !== user.id && !user.isAdmin) throw new UserError("Solo quien lo tiene puede soltarlo.");
    // El admin puede sacar a quien lo tomó o al externo (pedido de Mark, 27/11).
    const removed = job.responsibleId !== user.id;
    if (!job.responsibleId && !job.externoId) throw new UserError("Este trabajo no tiene a nadie asignado.");
    const who = removed
      ? job.externoId
        ? (await db.query.externos.findFirst({ where: eq(externos.id, job.externoId) }))?.name ?? "el externo"
        : (await db.query.users.findFirst({ where: eq(users.id, job.responsibleId!) }))?.name ?? "quien lo tenía"
      : null;
    const items = await db.select().from(jobItems).where(eq(jobItems.jobId, job.id));
    const pending = items.filter((i) => !i.doneAt);
    const doneItems = items.filter((i) => i.doneAt);
    const q = [
      db
        .update(jobs)
        .set({
          responsibleId: null,
          externoId: null,
          takenAt: null,
          status: job.status === "en_proceso" ? "confirmado" : job.status,
          statusChangedAt: job.status === "en_proceso" ? new Date() : job.statusChangedAt,
        })
        .where(eq(jobs.id, job.id)),
      audit({
        entity: "trabajo",
        entityId: job.id,
        jobId: job.id,
        action: "soltar",
        summary: removed
          ? `sacó a ${who} del trabajo${v.note ? ` · «${v.note}»` : ""}`
          : pending.length && doneItems.length
            ? `soltó el trabajo: hizo ${doneItems.map((i) => i.code).join(", ")}; falta ${pending.map((i) => i.code).join(", ")}`
            : "soltó el trabajo",
        after: { hechos: doneItems.map((i) => i.code), faltan: pending.map((i) => i.code), nota: v.note },
        userId: user.id,
      }),
    ];
    if (v.note) q.push(db.insert(jobNotes).values({ jobId: job.id, body: v.note, isHandoff: true, authorId: user.id }) as never);
    await batch(q as [ (typeof q)[number], ...(typeof q)[number][] ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Avance por ítem (RF-61) ---------- */

export async function toggleItem(jobItemId: string, doneNow: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const item = await db.query.jobItems.findFirst({ where: eq(jobItems.id, jobItemId) });
    if (!item) throw new UserError("Ese ítem ya no existe.");
    const job = await loadJob(item.jobId);
    assertOpenOrAdmin(user, job.status);
    const mine = job.responsibleId === user.id;
    // Producción marca lo suyo; un trabajo de externo lo marca quien se lo encargó; el admin todo.
    if (!mine && !user.isAdmin && !job.externoId) throw new UserError("Toma el trabajo para marcar su avance.");
    await batch([
      db
        .update(jobItems)
        .set(
          doneNow
            ? { doneAt: new Date(), doneById: job.externoId ? null : user.id, doneByExternoId: job.externoId }
            : { doneAt: null, doneById: null, doneByExternoId: null },
        )
        .where(eq(jobItems.id, item.id)),
      audit({
        entity: "item",
        entityId: item.id,
        jobId: job.id,
        action: "item",
        summary: doneNow ? `marcó hecho ${item.code} · ${item.name}` : `desmarcó ${item.code}`,
        userId: user.id,
      }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Cambios de estado (RF-09) ---------- */

async function moveStatus(user: CurrentUser, jobId: string, from: JobStatus[], to: JobStatus, summary: string, extra: Partial<typeof jobs.$inferInsert> = {}) {
  const job = await loadJob(jobId);
  if (!from.includes(job.status)) throw new UserError(`Este trabajo está en ${STATUS_LABEL[job.status]}. Recarga la página.`);
  await batch([
    db
      .update(jobs)
      .set({ status: to, statusChangedAt: new Date(), ...extra })
      .where(eq(jobs.id, jobId)),
    audit({ entity: "trabajo", entityId: jobId, jobId, action: "estado", summary, before: { status: job.status }, after: { status: to }, userId: user.id }),
  ]);
  return job;
}

/** Terminado: lo marca quien lo hizo (o quien se lo encargó al externo). Solo con todos los ítems hechos. */
export async function markFinished(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const job = await loadJob(jobId);
    if (job.responsibleId !== user.id && !user.isAdmin && !job.externoId) throw new UserError("Lo marca quien hizo el trabajo.");
    const [{ pending }] = await db
      .select({ pending: sql<number>`count(*) filter (where ${jobItems.doneAt} is null)::int` })
      .from(jobItems)
      .where(eq(jobItems.jobId, jobId));
    if (pending > 0) throw new UserError(`Faltan ${pending} ítems por marcar.`);
    await moveStatus(user, jobId, ["en_proceso", "confirmado"], "terminado", "lo marcó terminado");
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markSent(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    await moveStatus(user, jobId, ["terminado"], "en_revision", "lo envió al cliente", { sentAt: new Date() });
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function finalizeJob(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    // Regla pedida por Mark (27/11): no se finaliza con pagos pendientes.
    const job = await loadJob(jobId);
    const [pays, extras] = await Promise.all([
      db.select().from(payments).where(and(eq(payments.jobId, jobId), isNull(payments.deletedAt))),
      db.select().from(jobExtras).where(and(eq(jobExtras.jobId, jobId), isNull(jobExtras.deletedAt))),
    ]);
    const pending = round2(job.price + extras.reduce((a, e) => a + e.amount, 0) - paidNet(pays));
    if (pending > 0.004) throw new UserError(`No se puede finalizar: falta cobrar ${formatMoney(pending)}. Registra el pago primero.`);
    await moveStatus(user, jobId, ["en_revision", "terminado"], "finalizado", "lo finalizó: el cliente quedó conforme", { finishedAt: new Date(), finishedById: user.id });
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** «Corrección hecha»: pasa a Terminado (RF-65). */
export async function correctionDone(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const job = await loadJob(jobId);
    if (job.responsibleId !== user.id && !user.isAdmin && !job.externoId) throw new UserError("La marca quien hizo la corrección.");
    const open = await db.query.jobCorrections.findFirst({ where: and(eq(jobCorrections.jobId, jobId), isNull(jobCorrections.doneAt)) });
    await batch([
      db.update(jobs).set({ status: "terminado", statusChangedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.status, "correcciones"))),
      ...(open ? [db.update(jobCorrections).set({ doneAt: new Date() }).where(eq(jobCorrections.id, open.id))] : []),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "estado", summary: `terminó la corrección ${open?.number ?? ""}`.trim(), userId: user.id }),
    ] as never);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Correcciones (RF-65, RF-66) ---------- */

export async function requestCorrection(input: CorrectionInput): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = correctionSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const job = await loadJob(v.jobId);
    if (!["en_proceso", "en_revision", "terminado", "correcciones"].includes(job.status)) throw new UserError("Este trabajo no está para correcciones.");
    // Las correcciones también las puede hacer el empleado (pedido de Mark, 27/11).
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(jobCorrections).where(eq(jobCorrections.jobId, job.id));
    const number = n + 1;
    const counts = v.charge !== "error_estudio";
    const newDueAt = limaInstant(v.newDueDate, v.newDueTime);
    const corrId = crypto.randomUUID();
    const charged = (v.charge === "se_cobra" || v.charge === "extra") && (v.amount ?? 0) > 0;
    const responsible = v.who === "yo" ? { responsibleId: user.id, externoId: null, takenAt: new Date() } : v.who === "externo" ? { responsibleId: null, externoId: v.externoId!, takenAt: new Date() } : { responsibleId: null, externoId: null, takenAt: null };

    const q = [
      db.insert(jobCorrections).values({
        id: corrId,
        jobId: job.id,
        number,
        request: v.request,
        charge: v.charge,
        whatFailed: v.charge === "error_estudio" ? v.whatFailed : null,
        amount: charged ? v.amount! : null,
        previousDueAt: job.dueAt,
        newDueAt,
        receivedById: user.id,
        takenById: v.who === "yo" ? user.id : null,
        externoId: v.who === "externo" ? v.externoId! : null,
      }),
      db
        .update(jobs)
        .set({
          status: "correcciones",
          statusChangedAt: new Date(),
          dueAt: newDueAt,
          correctionRounds: counts ? job.correctionRounds + 1 : job.correctionRounds,
          ...responsible,
        })
        .where(eq(jobs.id, job.id)),
      audit({
        entity: "trabajo",
        entityId: job.id,
        jobId: job.id,
        action: "correccion",
        summary:
          v.charge === "error_estudio"
            ? `registró la corrección ${number} por error del estudio: ${v.whatFailed}`
            : `registró la corrección ${number}${counts ? ` (ronda ${job.correctionRounds + 1} de 2)` : ""}${charged ? ` · se cobra ${formatMoney(v.amount!)}` : ""}`,
        before: { dueAt: job.dueAt, status: job.status },
        after: { dueAt: newDueAt, status: "correcciones", charge: v.charge },
        userId: user.id,
      }),
    ];
    if (charged) {
      q.push(db.insert(jobExtras).values({ jobId: job.id, correctionId: corrId, reason: `Corrección ${number} · ${v.request}`.slice(0, 300), amount: v.amount!, createdById: user.id }) as never);
      if (v.paidNow) {
        q.push(
          db.insert(payments).values({
            jobId: job.id,
            amount: v.amount!,
            method: v.method!,
            operationNumber: v.operationNumber,
            label: `extra · corrección ${number}`,
            correctionId: corrId,
            createdById: user.id,
          }) as never,
        );
      }
    }
    await batch(q as [ (typeof q)[number], ...(typeof q)[number][] ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Editar (RF-16: precio, urgencia, ítems, adicional, descuento) ---------- */

export async function editJob(input: EditJobInput): Promise<ActionResult<{ overpaid: number }>> {
  try {
    const user = await assertRole();
    const parsed = editJobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const job = await loadJob(v.jobId);
    assertOpenOrAdmin(user, job.status);
    const s = await getSettings();
    const current = await db.select().from(jobItems).where(eq(jobItems.jobId, job.id));
    const currentById = new Map(current.map((i) => [i.id, i]));

    // Los ítems que ya estaban conservan su precio y factor congelados; los nuevos toman el tarifario de hoy.
    const factor = cycleFactor(s.cycleFactors, job.cycle);
    const fresh = await priceLines(
      v.items.filter((l) => !l.jobItemId || !currentById.has(l.jobItemId)),
      factor,
    );
    let k = 0;
    const merged = v.items.map((l, i) => {
      const old = l.jobItemId ? currentById.get(l.jobItemId) : undefined;
      if (old) {
        const base = old.categoryCode === "OT" && l.customPrice !== undefined ? round2(l.customPrice) : old.basePrice;
        const unitHours = old.quantity ? old.hours / old.quantity : 0;
        return {
          id: old.id,
          keep: true,
          code: old.code,
          quantity: l.quantity,
          basePrice: base,
          pricingMode: old.pricingMode,
          factor: old.factor,
          hours: round2((old.categoryCode === "OT" && l.hours !== undefined ? l.hours : unitHours) * l.quantity),
          amount: round2(base * l.quantity * old.factor),
          detail: old.categoryCode === "OT" ? (l.detail ?? old.detail) : old.detail,
          sortOrder: i,
        };
      }
      const f = fresh[k++];
      return { id: crypto.randomUUID(), keep: false, ...f, sortOrder: i };
    });
    const removed = current.filter((c) => !merged.some((m) => m.keep && m.id === c.id));
    if (removed.some((r) => r.doneAt)) throw new UserError("No se puede quitar un ítem que ya está hecho.");

    const pct = v.urgency === job.urgency ? job.urgencyPct : s.urgency[v.urgency].pct;
    const subtotal = round2(merged.reduce((a, m) => a + m.amount, 0));
    const price = Math.max(0, round2(subtotal * (1 + pct / 100) + v.complexityExtra - v.discount));
    const hours = round2(merged.reduce((a, m) => a + m.hours, 0));

    // Al cambiar la urgencia la entrega se ajusta al plazo del nivel (RF-16).
    let dueAt = job.dueAt;
    if (v.dueDate && v.dueTime) dueAt = limaInstant(v.dueDate, v.dueTime);
    else if (v.urgency !== job.urgency) {
      const byPlazo = new Date(Date.now() + s.urgency[v.urgency].hours * 3_600_000);
      const up = s.urgency[v.urgency].pct > job.urgencyPct;
      dueAt = up ? (byPlazo < job.dueAt ? byPlazo : job.dueAt) : byPlazo > job.dueAt ? byPlazo : job.dueAt;
    }

    const pays = await db.select().from(payments).where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)));
    const extras = await db.select().from(jobExtras).where(and(eq(jobExtras.jobId, job.id), isNull(jobExtras.deletedAt)));
    const paid = paidNet(pays);
    const total = round2(price + extras.reduce((a, e) => a + e.amount, 0));

    const changes: string[] = [];
    if (price !== job.price) changes.push(`precio ${formatMoney(job.price)} → ${formatMoney(price)}`);
    if (v.urgency !== job.urgency) changes.push(`urgencia ${URGENCY_LABEL[job.urgency]} → ${URGENCY_LABEL[v.urgency]}`);
    if (dueAt.getTime() !== job.dueAt.getTime()) changes.push("entrega movida");

    const q = [
      db
        .update(jobs)
        .set({
          urgency: v.urgency,
          urgencyPct: pct,
          complexityExtra: v.complexityExtra,
          discount: v.discount,
          price,
          estimatedHours: hours,
          dueAt,
          course: v.course,
          professor: v.professor,
          section: v.section,
          title: v.title,
          ...(v.externoId !== undefined && v.externoId !== job.externoId
            ? { externoId: v.externoId, responsibleId: v.externoId ? null : job.responsibleId, takenAt: v.externoId ? new Date() : job.takenAt, status: v.externoId && job.status === "confirmado" ? ("en_proceso" as const) : job.status }
            : {}),
        })
        .where(eq(jobs.id, job.id)),
      ...removed.map((r) => db.delete(jobItems).where(eq(jobItems.id, r.id))),
      ...merged.map((m) =>
        m.keep
          ? db
              .update(jobItems)
              .set({ quantity: m.quantity, basePrice: m.basePrice, hours: m.hours, amount: m.amount, detail: m.detail, sortOrder: m.sortOrder })
              .where(eq(jobItems.id, m.id))
          : db.insert(jobItems).values({
              id: m.id,
              jobId: job.id,
              serviceItemId: (m as { serviceItemId: string }).serviceItemId,
              code: m.code,
              categoryCode: (m as { categoryCode: string }).categoryCode,
              name: (m as { name: string }).name,
              detail: m.detail,
              unit: (m as { unit: string }).unit,
              pricingMode: m.pricingMode,
              basePrice: m.basePrice,
              factor: m.factor,
              quantity: m.quantity,
              hours: m.hours,
              amount: m.amount,
              sortOrder: m.sortOrder,
            }),
      ),
      audit({
        entity: "trabajo",
        entityId: job.id,
        jobId: job.id,
        action: price !== job.price ? "precio" : "editar",
        summary: `editó el trabajo${changes.length ? `: ${changes.join(", ")}` : ""} · «${v.reason}»`,
        before: { price: job.price, urgency: job.urgency, dueAt: job.dueAt },
        after: { price, urgency: v.urgency, dueAt, reason: v.reason },
        userId: user.id,
      }),
    ];
    if (v.externoId !== undefined && v.externoId !== job.externoId && v.externoId) {
      const ex = await db.query.externos.findFirst({ where: eq(externos.id, v.externoId) });
      q.push(audit({ entity: "trabajo", entityId: job.id, jobId: job.id, action: "asignar", summary: `lo encargó a ${ex?.name ?? "un externo"} (externo)`, userId: user.id }) as never);
    }
    await batch(q as [ (typeof q)[number], ...(typeof q)[number][] ]);
    done();
    return { ok: true, data: { overpaid: round2(Math.max(0, paid - total)) } };
  } catch (e) {
    return fail(e);
  }
}

/** Campos opcionales desde la ficha («+ Agregar» curso o profesor). */
export async function setJobField(jobId: string, field: "course" | "professor" | "section", value: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const job = await loadJob(jobId);
    assertOpenOrAdmin(user, job.status);
    const val = value.trim().slice(0, 120) || null;
    await batch([
      db.update(jobs).set({ [field]: val }).where(eq(jobs.id, jobId)),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "editar", summary: `cambió ${field === "course" ? "el curso" : field === "professor" ? "el profesor" : "la sección"} a «${val ?? "—"}»`, userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Anular y reabrir (RF-63) ---------- */

export async function cancelJob(input: CancelInput): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const job = await loadJob(v.jobId);
    if (job.status === "cancelado") throw new UserError("Ya está cancelado.");
    assertOpenOrAdmin(user, job.status);
    const pays = await db.select().from(payments).where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)));
    const paid = paidNet(pays);
    if (v.refund && (v.amount ?? 0) > paid + 0.004) throw new UserError(`No se puede devolver más de lo pagado (${formatMoney(paid)}).`);
    const reason = CANCEL_REASON[v.reasonKind];
    const q = [
      db
        .update(jobs)
        .set({
          status: "cancelado",
          statusChangedAt: new Date(),
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancelReason: reason,
          cancelNote: v.note,
          cancelledFromStatus: job.status,
        })
        .where(eq(jobs.id, job.id)),
      audit({
        entity: "trabajo",
        entityId: job.id,
        jobId: job.id,
        action: "anular",
        summary: `anuló el pedido · ${reason}${v.note ? ` · «${v.note}»` : ""}`,
        before: { status: job.status },
        after: { status: "cancelado" },
        userId: user.id,
      }),
    ];
    if (v.refund && v.amount) {
      q.push(
        db.insert(payments).values({
          jobId: job.id,
          kind: "devolucion",
          amount: v.amount,
          method: v.method!,
          paidAt: v.paidDate ? limaInstant(v.paidDate, "12:00") : new Date(),
          operationNumber: v.operationNumber,
          label: "Devolución",
          reason: `Anuló el pedido · ${reason}`,
          createdById: user.id,
        }) as never,
        audit({ entity: "pago", entityId: job.id, jobId: job.id, action: "devolucion", summary: `devolvió ${formatMoney(v.amount)} al anular`, userId: user.id }) as never,
      );
    }
    await batch(q as [ (typeof q)[number], ...(typeof q)[number][] ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Reabrir: solo si no se devolvió dinero; sigue desde el paso donde quedó. */
export async function reopenJob(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const job = await loadJob(jobId);
    if (job.status !== "cancelado") throw new UserError("No está cancelado.");
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(eq(payments.jobId, jobId), eq(payments.kind, "devolucion"), isNull(payments.voidedAt), isNull(payments.deletedAt)));
    if (n > 0) throw new UserError("Ya se devolvió dinero: no se reabre. Usa «Nuevo pedido desde este».");
    const to = job.cancelledFromStatus ?? "confirmado";
    await batch([
      db
        .update(jobs)
        .set({ status: to, statusChangedAt: new Date(), cancelledAt: null, cancelledById: null, cancelReason: null, cancelNote: null, cancelledFromStatus: null })
        .where(eq(jobs.id, jobId)),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "reabrir", summary: `reabrió el trabajo en ${STATUS_LABEL[to]}`, userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Confirmar una cotización: entra al pozo (RF-58). */
export async function confirmQuote(jobId: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    // Regla pedida por Mark (27/11): no se confirma sin el 50 % pagado.
    const job = await loadJob(jobId);
    const [pays, extras] = await Promise.all([
      db.select().from(payments).where(and(eq(payments.jobId, jobId), isNull(payments.deletedAt))),
      db.select().from(jobExtras).where(and(eq(jobExtras.jobId, jobId), isNull(jobExtras.deletedAt))),
    ]);
    const half = round2((job.price + extras.reduce((a, e) => a + e.amount, 0)) / 2);
    const missing = round2(half - paidNet(pays));
    if (missing > 0.004) throw new UserError(`Para confirmar falta pagar ${formatMoney(missing)} (el 50 % es ${formatMoney(half)}). Registra el adelanto primero.`);
    await moveStatus(user, jobId, ["cotizacion"], "confirmado", "confirmó la cotización");
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Notas (RF-44, RF-67) ---------- */

export async function addNote(input: { jobId: string; body: string }): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await loadJob(parsed.data.jobId);
    await batch([
      db.insert(jobNotes).values({ jobId: parsed.data.jobId, body: parsed.data.body, authorId: user.id }),
      audit({ entity: "nota", entityId: parsed.data.jobId, jobId: parsed.data.jobId, action: "nota", summary: "escribió un apunte", userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Ayudas para la ventana Nuevo trabajo ---------- */

export type ClientHit = { id: string; name: string; whatsapp: string; university: string | null; career: string | null; cycle: number | null; jobs: number; debt: number };

/** RF-06: buscar por nombre o número. */
export async function searchClients(q: string): Promise<ClientHit[]> {
  await assertRole();
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const rows = await db
    .select({ id: clients.id, name: clients.name, whatsapp: clients.whatsapp, university: clients.university, career: clients.career, cycle: clients.cycle })
    .from(clients)
    .where(
      and(
        isNull(clients.deletedAt),
        digits.length >= 3
          ? sql`${clients.whatsapp} like ${"%" + digits + "%"}`
          : sql`translate(lower(${clients.name}), 'áéíóúüñ', 'aeiouun') like ${"%" + term.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() + "%"}`,
      ),
    )
    .limit(8);
  return Promise.all(rows.map(async (r) => ({ ...r, ...(await clientMoney(r.id)) })));
}

async function clientMoney(clientId: string) {
  const js = await db
    .select({ id: jobs.id, price: jobs.price, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.clientId, clientId), isNull(jobs.deletedAt)));
  if (js.length === 0) return { jobs: 0, debt: 0 };
  const ids = js.map((j) => j.id);
  const pays = await db.select().from(payments).where(and(inArray(payments.jobId, ids), isNull(payments.deletedAt)));
  const ex = await db.select().from(jobExtras).where(and(inArray(jobExtras.jobId, ids), isNull(jobExtras.deletedAt)));
  let debt = 0;
  for (const j of js) {
    if (j.status === "cancelado" || j.status === "cotizacion") continue;
    const total = j.price + ex.filter((e) => e.jobId === j.id).reduce((a, e) => a + e.amount, 0);
    debt += Math.max(0, total - paidNet(pays.filter((p) => p.jobId === j.id)));
  }
  return { jobs: js.length, debt: round2(debt) };
}

export type ClientContext = {
  client: ClientHit & { software: string | null; softwareVersion: string | null; usualFormat: string | null; requestedFiles: string | null; otherPrefs: string | null };
  debts: { code: string; title: string; pending: number; dueAt: string }[];
  openJobs: { id: string; code: string; title: string; course: string | null }[];
  finished: { id: string; code: string; title: string }[];
  alerts: { body: string }[];
  usualPerson: string | null;
};

/** Avisos al elegir al cliente: deuda (RF-46), abiertos (RF-37), finalizados (RF-64), observaciones (RF-45). */
export async function clientContext(clientId: string): Promise<ClientContext | null> {
  const user = await assertRole();
  const c = await db.query.clients.findFirst({ where: and(eq(clients.id, clientId), isNull(clients.deletedAt)), with: { observations: true } });
  if (!c) return null;
  const money = await clientMoney(c.id);
  const js = await db
    .select({ id: jobs.id, code: jobs.code, title: jobs.title, course: jobs.course, status: jobs.status, price: jobs.price, dueAt: jobs.dueAt, responsibleId: jobs.responsibleId })
    .from(jobs)
    .where(and(eq(jobs.clientId, c.id), isNull(jobs.deletedAt)));
  const ids = js.map((j) => j.id);
  const pays = ids.length ? await db.select().from(payments).where(and(inArray(payments.jobId, ids), isNull(payments.deletedAt))) : [];
  const ex = ids.length ? await db.select().from(jobExtras).where(and(inArray(jobExtras.jobId, ids), isNull(jobExtras.deletedAt))) : [];
  const debts = js
    .filter((j) => j.status !== "cancelado" && j.status !== "cotizacion")
    .map((j) => {
      const total = j.price + ex.filter((e) => e.jobId === j.id).reduce((a, e) => a + e.amount, 0);
      return { code: j.code, title: j.title, pending: round2(Math.max(0, total - paidNet(pays.filter((p) => p.jobId === j.id)))), dueAt: j.dueAt.toISOString() };
    })
    .filter((d) => d.pending > 0);
  // Responsable habitual: se calcula solo y solo lo ve el admin (RF-38).
  let usualPerson: string | null = null;
  if (user.isAdmin) {
    const counts = new Map<string, number>();
    for (const j of js) if (j.responsibleId) counts.set(j.responsibleId, (counts.get(j.responsibleId) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) usualPerson = (await db.query.users.findFirst({ where: eq(users.id, top[0]), columns: { name: true } }))?.name ?? null;
  }
  return {
    client: {
      id: c.id,
      name: c.name,
      whatsapp: c.whatsapp,
      university: c.university,
      career: c.career,
      cycle: c.cycle,
      software: c.software,
      softwareVersion: c.softwareVersion,
      usualFormat: c.usualFormat,
      requestedFiles: c.requestedFiles,
      otherPrefs: c.otherPrefs,
      ...money,
    },
    debts,
    openJobs: js.filter((j) => !["finalizado", "cancelado"].includes(j.status)).map((j) => ({ id: j.id, code: j.code, title: j.title, course: j.course })),
    finished: js.filter((j) => j.status === "finalizado").map((j) => ({ id: j.id, code: j.code, title: j.title })),
    alerts: c.observations.filter((o) => o.alertOnNewJob).map((o) => ({ body: o.body })),
    usualPerson,
  };
}

/** RF-36: si el número ya existe, se ofrece usar al cliente existente. */
export async function findClientByPhone(phone: string): Promise<ClientHit | null> {
  await assertRole();
  const d = phone.replace(/\D/g, "").replace(/^51(?=\d{9}$)/, "");
  if (d.length !== 9) return null;
  const c = await db.query.clients.findFirst({ where: and(eq(clients.whatsapp, d), isNull(clients.deletedAt)) });
  if (!c) return null;
  return { id: c.id, name: c.name, whatsapp: c.whatsapp, university: c.university, career: c.career, cycle: c.cycle, ...(await clientMoney(c.id)) };
}

export type CourseMatch = { code: string; title: string; who: string | null; sure: boolean };

/** RF-35: trabajos del mismo curso (solo aviso). Compara solo lo que está lleno. */
export async function sameCourseJobs(input: { clientId?: string; course?: string; professor?: string; university?: string | null; dueDate?: string }): Promise<CourseMatch[]> {
  await assertRole();
  const course = input.course?.trim();
  if (!course || course.length < 3) return [];
  const term = academicTermFor(input.dueDate ? limaInstant(input.dueDate) : new Date());
  const rows = await db
    .select({ code: jobs.code, title: jobs.title, clientId: jobs.clientId, professor: jobs.professor, university: jobs.university, academicTerm: jobs.academicTerm, who: users.name, ext: externos.name })
    .from(jobs)
    .leftJoin(users, eq(users.id, jobs.responsibleId))
    .leftJoin(externos, eq(externos.id, jobs.externoId))
    .where(and(isNull(jobs.deletedAt), sql`lower(${jobs.course}) = lower(${course})`, sql`${jobs.status} <> 'cancelado'`))
    .limit(20);
  return rows
    .filter((r) => r.clientId !== input.clientId)
    .filter((r) => !input.university || !r.university || r.university === input.university)
    .filter((r) => !input.professor || !r.professor || r.professor.toLowerCase() === input.professor.toLowerCase())
    .filter((r) => !r.academicTerm || r.academicTerm === term)
    .map((r) => ({ code: r.code, title: r.title, who: r.who ?? (r.ext ? `${r.ext} (externo)` : null), sure: !!(input.professor && r.professor) }));
}
