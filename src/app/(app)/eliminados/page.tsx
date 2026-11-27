import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Eliminados" };

export default async function Page() {
  await requireUser("admin");
  return (
    <PageBody>
      <PageHeader n="11" title="Eliminados" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
