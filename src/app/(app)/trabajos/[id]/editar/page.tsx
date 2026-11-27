import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { activeCatalogs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";

export const metadata: Metadata = { title: "Editar trabajo" };

export default async function EditJobPage({ params }: PageProps<"/trabajos/[id]/editar">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [job, catalogs] = await Promise.all([
    db.query.jobs.findFirst({
      where: and(eq(jobs.id, id), isNull(jobs.deletedAt)),
      with: { client: { columns: { id: true, name: true, whatsapp: true, university: true, software: true, softwareVersion: true, usualFormat: true, preferredResponsableId: true } } },
    }),
    activeCatalogs(),
  ]);
  if (!job) notFound();
  return (
    <>
      <PageHeader index={`Trabajos / ${job.code}`} title={`Editar ${job.code}`} description="El estado se cambia desde la ficha. Los cambios de precio quedan en el historial." />
      <JobForm
        mode="editar"
        jobId={job.id}
        code={job.code}
        serviceTypes={catalogs.serviceTypes}
        responsables={catalogs.responsables}
        initialClient={job.client}
        canEditPrice={user.role === "admin" || job.price === null}
        defaults={{
          serviceTypeId: job.serviceTypeId,
          course: job.course ?? "",
          professor: job.professor ?? "",
          section: job.section ?? "",
          academicTerm: job.academicTerm ?? "",
          description: job.description,
          dueDate: job.dueDate ?? "",
          urgency: job.urgency,
          price: job.price ?? "",
          responsableId: job.responsableId ?? "",
        }}
      />
    </>
  );
}
