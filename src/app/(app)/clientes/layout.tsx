import { requireUser } from "@/lib/auth-guard";
import { listClients } from "@/lib/queries/clients";
import { ClientList } from "@/components/clients/client-list";

/** Lista a la izquierda y ficha del cliente a la derecha (en el celular, una a la vez). */
export default async function ClientsLayout({ children }: LayoutProps<"/clientes">) {
  await requireUser();
  const { rows } = await listClients();
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ClientList rows={rows} />
      {children}
    </div>
  );
}
