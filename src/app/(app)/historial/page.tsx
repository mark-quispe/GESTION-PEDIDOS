import { requireUser } from "@/lib/auth-guard";
import { getHistory } from "@/lib/queries/history";
import { PageBody } from "@/components/layout/page-header";
import { HistoryBoard } from "@/components/admin/history-board";

export const metadata = { title: "Historial" };

/** RF-21 / RNF-24: quién cambió qué y cuándo (solo admin). */
export default async function HistoryPage() {
  await requireUser("admin");
  const rows = await getHistory();
  return (
    <PageBody className="lg:h-dvh lg:max-h-dvh lg:min-h-[760px] lg:overflow-hidden">
      <HistoryBoard rows={rows} />
    </PageBody>
  );
}
