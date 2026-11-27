import { requireUser } from "@/lib/auth-guard";
import { getDashboard } from "@/lib/queries/dashboard";
import { PageBody } from "@/components/layout/page-header";
import { HomeBoard } from "@/components/home/home-board";

export const metadata = { title: "Inicio" };

/** RF-19, RF-49, RF-50: lo que hay que entregar, cobrar y responder. Misma distribución para admin y empleado (pedido de Mark, 27/11). */
export default async function HomePage() {
  const user = await requireUser();
  const admin = user.isAdmin && !user.viewAsEmployee;
  const d = await getDashboard(admin);
  return (
    <PageBody className="xl:h-dvh xl:max-h-dvh xl:min-h-[900px] xl:overflow-hidden [&_*]:leading-[normal]">
      <HomeBoard d={d} canTake={user.canTake} />
    </PageBody>
  );
}
