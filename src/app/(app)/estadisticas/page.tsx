import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Estadísticas" };

export default async function Page() {
  await requireUser("admin");
  return (
    <PageBody>
      <PageHeader n="06" title="Estadísticas" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
