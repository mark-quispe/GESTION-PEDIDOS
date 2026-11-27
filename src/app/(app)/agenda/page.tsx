import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Agenda" };

export default async function Page() {
  await requireUser();
  return (
    <PageBody>
      <PageHeader n="04" title="Agenda" description="Esta pestaña se está programando." />
    </PageBody>
  );
}
