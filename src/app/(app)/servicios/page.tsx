import { requireUser } from "@/lib/auth-guard";
import { getServices } from "@/lib/queries/services";
import { PageBody } from "@/components/layout/page-header";
import { ServicesBoard } from "@/components/admin/services-board";

export const metadata = { title: "Servicios" };

/** Servicios = tarifario (RF-08, RF-57, RF-68). El admin lo cambia; los demás lo consultan. */
export default async function ServicesPage() {
  const user = await requireUser();
  const admin = user.isAdmin && !user.viewAsEmployee;
  const data = await getServices();
  return (
    <PageBody className="lg:h-dvh lg:max-h-dvh lg:min-h-[860px] lg:overflow-hidden">
      <ServicesBoard data={data} admin={admin} n={admin ? "08" : "05"} />
    </PageBody>
  );
}
