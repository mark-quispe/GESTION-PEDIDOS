import { requireUser } from "@/lib/auth-guard";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Inicio" };

export default async function Page() {
  await requireUser();
  return (
    <PageBody>
      <PageHeader n="01" title="Inicio" description="Lo que hay que entregar, cobrar y responder." />
    </PageBody>
  );
}
