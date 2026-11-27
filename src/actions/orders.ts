"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { assertRole, AuthError } from "@/lib/auth-guard";
import { createOrderSchema, updateStatusSchema, type CreateOrderInput } from "@/lib/validation/orders";
import type { ActionResult } from "./result";

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof AuthError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Ha ocurrido un error. Inténtalo de nuevo." };
}

export async function createOrder(input: CreateOrderInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertRole(); // admin o empleado
    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los campos", fieldErrors: z.flattenError(parsed.error).fieldErrors };
    }
    const { items, ...data } = parsed.data;
    const total = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);

    // neon-http no soporta transacciones interactivas: insertamos el pedido y luego sus líneas.
    const [order] = await db
      .insert(orders)
      .values({
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        notes: data.notes || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        total: total.toFixed(2),
        createdById: user.id,
      })
      .returning({ id: orders.id });

    await db.insert(orderItems).values(
      items.map((i) => ({
        orderId: order.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toFixed(2),
      })),
    );

    revalidatePath("/pedidos");
    return { ok: true, data: { id: order.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateOrderStatus(input: z.input<typeof updateStatusSchema>): Promise<ActionResult> {
  try {
    await assertRole();
    const { orderId, status } = updateStatusSchema.parse(input);
    await db.update(orders).set({ status }).where(eq(orders.id, orderId));
    revalidatePath("/pedidos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Borrar pedidos es solo para administradores. */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  try {
    await assertRole("admin");
    await db.delete(orders).where(eq(orders.id, z.uuid().parse(orderId)));
    revalidatePath("/pedidos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
