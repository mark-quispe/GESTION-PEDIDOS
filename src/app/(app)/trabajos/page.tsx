import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Trabajos" };

export default async function Page() {
  await requireUser();
  return (
    <PageBody>
      <PageHeader n="02" title="Trabajos" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
