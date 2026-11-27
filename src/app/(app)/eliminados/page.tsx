import { requireUser } from "@/lib/auth-guard";
import { listDeleted } from "@/lib/queries/deleted";
import { PageBody } from "@/components/layout/page-header";
import { DeletedBoard } from "@/components/admin/deleted-board";

export const metadata = { title: "Eliminados" };

/** RF-29: nada se borra de verdad; aquí se restaura (solo admin). */
export default async function DeletedPage() {
  await requireUser("admin");
  const rows = await listDeleted();
  return (
    <PageBody>
      <header className="[&_*]:leading-[normal]">
        <p className="font-mono text-[11px] text-muted">10 · Eliminados</p>
        <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Eliminados</h1>
        <p className="text-sm text-muted">Nada se borra de verdad. Lo eliminado se guarda aquí y se puede restaurar.</p>
      </header>
      <DeletedBoard rows={rows} />
    </PageBody>
  );
}
