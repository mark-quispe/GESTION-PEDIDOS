import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Producción" };

export default async function Page() {
  await requireUser("admin");
  return (
    <PageBody>
      <PageHeader n="08" title="Producción" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
