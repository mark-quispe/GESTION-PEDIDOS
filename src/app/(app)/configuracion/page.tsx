import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Configuración" };

export default async function Page() {
  await requireUser("admin");
  return (
    <PageBody>
      <PageHeader n="13" title="Configuración" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
