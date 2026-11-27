import { requireUser } from "@/lib/auth-guard";
import { getProduction } from "@/lib/queries/production";
import { getTarifario } from "@/lib/queries/catalog";
import { PageBody } from "@/components/layout/page-header";
import { ProductionBoard } from "@/components/admin/production-board";

export const metadata = { title: "Producción" };

/** RF-18: quienes hacen los trabajos y cuántas horas hicieron (solo admin). */
export default async function ProductionPage() {
  await requireUser("admin");
  const [data, tarifario] = await Promise.all([getProduction(), getTarifario()]);
  return (
    <PageBody>
      <ProductionBoard data={data} tarifario={tarifario.filter((t) => !t.isCustom).map((t) => ({ code: t.code, name: t.name, categoryName: t.categoryName }))} />
    </PageBody>
  );
}
