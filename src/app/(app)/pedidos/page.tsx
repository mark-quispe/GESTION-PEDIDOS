import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";

export const metadata: Metadata = { title: "Pedidos" };

export default async function OrdersPage() {
  const user = await requireUser();
  const rows = await db.query.orders.findMany({
    orderBy: desc(orders.createdAt),
    limit: 500,
    with: { createdBy: { columns: { name: true, email: true } } },
  });

  const data: OrderRow[] = rows.map((o) => ({
    id: o.id,
    number: o.number,
    customerName: o.customerName,
    status: o.status,
    total: o.total,
    dueAt: o.dueAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    createdBy: o.createdBy?.name ?? o.createdBy?.email ?? "—",
  }));

  return (
    <>
      <PageHeader index="01" title="Pedidos" description="Consulta, filtra y actualiza el estado de los pedidos.">
        <Button asChild>
          <Link href="/pedidos/nuevo">
            <Plus /> Nuevo pedido
          </Link>
        </Button>
      </PageHeader>
      <OrdersTable data={data} canDelete={user.role === "admin"} />
    </>
  );
}
