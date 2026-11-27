"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { db, batch } from "@/db";
import { clients, jobs, payments } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { fail, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";

/** RF-29: restaurar lo eliminado (solo admin). Un trabajo vuelve con sus pagos; un pago vuelve a contar en lo pendiente. */
export async function restoreRecord(kind: "trabajo" | "pago" | "cliente", id: string): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    if (kind === "cliente") {
      const c = await db.query.clients.findFirst({ where: and(eq(clients.id, id), isNotNull(clients.deletedAt)) });
      if (!c) throw new UserError("Ese cliente ya no está en Eliminados.");
      const twin = await db.query.clients.findFirst({ where: and(eq(clients.whatsapp, c.whatsapp), isNull(clients.deletedAt), ne(clients.id, id)) });
      if (twin) throw new UserError(`Ya hay otro cliente con ese WhatsApp: ${twin.name}.`);
      await batch([
        db.update(clients).set({ deletedAt: null, deletedById: null }).where(eq(clients.id, id)),
        audit({ entity: "cliente", entityId: id, action: "restaurar", summary: `restauró al cliente ${c.name}`, userId: me.id }),
      ]);
    } else if (kind === "trabajo") {
      const j = await db.query.jobs.findFirst({ where: and(eq(jobs.id, id), isNotNull(jobs.deletedAt)) });
      if (!j) throw new UserError("Ese trabajo ya no está en Eliminados.");
      const c = await db.query.clients.findFirst({ where: eq(clients.id, j.clientId) });
      await batch([
        db.update(jobs).set({ deletedAt: null, deletedById: null }).where(eq(jobs.id, id)),
        ...(c?.deletedAt ? [db.update(clients).set({ deletedAt: null, deletedById: null }).where(eq(clients.id, c.id))] : []),
        audit({ entity: "trabajo", entityId: id, jobId: id, action: "restaurar", summary: `restauró el trabajo ${j.code}${c?.deletedAt ? ` y a su cliente ${c.name}` : ""}`, userId: me.id }),
      ]);
    } else {
      const p = await db.query.payments.findFirst({ where: and(eq(payments.id, id), isNotNull(payments.deletedAt)) });
      if (!p) throw new UserError("Ese pago ya no está en Eliminados.");
      await batch([
        db.update(payments).set({ deletedAt: null, deletedById: null }).where(eq(payments.id, id)),
        audit({ entity: "pago", entityId: id, jobId: p.jobId, action: "restaurar", summary: `restauró ${p.kind === "devolucion" ? "una devolución" : "un pago"} de S/ ${p.amount.toFixed(2)}`, userId: me.id }),
      ]);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
