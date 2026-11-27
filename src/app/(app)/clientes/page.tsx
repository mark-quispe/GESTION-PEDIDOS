import { Users } from "lucide-react";

export const metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-2 text-center md:flex">
      <Users className="size-6 text-faint" strokeWidth={1.5} />
      <p className="text-sm text-muted">Elige un cliente para ver sus trabajos, pagos y preferencias.</p>
    </div>
  );
}
