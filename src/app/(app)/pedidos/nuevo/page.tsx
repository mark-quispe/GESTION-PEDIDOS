import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { OrderForm } from "@/components/orders/order-form";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default function NewOrderPage() {
  return (
    <>
      <PageHeader index="02" title="Nuevo pedido" description="Registra los datos del cliente y las líneas del pedido." />
      <OrderForm />
    </>
  );
}
