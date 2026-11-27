import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Clientes" };

export default async function Page() {
  await requireUser();
  return (
    <PageBody>
      <PageHeader n="03" title="Clientes" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
