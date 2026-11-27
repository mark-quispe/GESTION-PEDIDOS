import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { addDays, todayLima, weekStart } from "@/lib/dates";
import { ACTIVE_STATUSES } from "@/lib/domain";
import { activeCatalogs, listJobs, type JobListRow } from "@/lib/queries";
import { cn, formatDay } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge, UrgencyBadge } from "@/components/jobs/badges";

export const metadata: Metadata = { title: "Carga por responsable" };

/** RF-41: trabajos en curso por responsable y por semana, sin montos. */
export default async function WorkloadPage() {
  await requireUser();
  const today = todayLima();
  const thisWeek = weekStart(today);
  const weeks = [0, 1, 2, 3].map((i) => addDays(thisWeek, i * 7));
  const [rows, { responsables }] = await Promise.all([listJobs(inArray(jobs.status, ACTIVE_STATUSES)), activeCatalogs()]);

  const buckets = [
    { key: "atrasados", label: "Atrasados", match: (r: JobListRow) => r.late },
    ...weeks.map((w, i) => ({
      key: w,
      label: i === 0 ? "Esta semana" : i === 1 ? "Próxima semana" : `Semana del ${formatDay(w)}`,
      match: (r: JobListRow) => !r.late && !!r.dueDate && r.dueDate >= w && r.dueDate < addDays(w, 7),
    })),
    { key: "despues", label: "Después", match: (r: JobListRow) => !r.late && !!r.dueDate && r.dueDate >= addDays(thisWeek, 28) },
    { key: "sin", label: "Sin fecha", match: (r: JobListRow) => !r.dueDate },
  ];

  const people = [
    ...responsables.filter((p) => p.active || rows.some((r) => r.responsableId === p.id)).map((p) => ({ id: p.id as string | null, name: p.name })),
    { id: null, name: "Sin responsable" },
  ].filter((p) => p.id !== null || rows.some((r) => !r.responsableId));

  return (
    <>
      <PageHeader index="Carga" title="Carga por responsable" description="Trabajos confirmados y en curso, por semana de entrega. Úsalo antes de asignar un trabajo nuevo." />
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-44 border-b bg-background px-3 py-2 text-left font-mono text-xs font-normal text-muted-foreground">Responsable</th>
              {buckets.map((b) => (
                <th key={b.key} className={cn("border-b px-3 py-2 text-left font-mono text-xs font-normal", b.key === "atrasados" ? "text-danger" : "text-muted-foreground")}>
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const mine = rows.filter((r) => r.responsableId === p.id);
              return (
                <tr key={p.id ?? "sin"} className="align-top">
                  <th scope="row" className="sticky left-0 z-10 border-b bg-background px-3 py-3 text-left font-medium">
                    {p.name}
                    <span className="block font-mono text-xs font-normal text-muted-foreground">{mine.length} en curso</span>
                  </th>
                  {buckets.map((b) => {
                    const items = mine.filter(b.match).sort((a, c) => (a.dueDate ?? "").localeCompare(c.dueDate ?? ""));
                    return (
                      <td key={b.key} className="border-b px-2 py-2">
                        <div className="grid gap-1.5">
                          {items.map((r) => (
                            <Link key={r.id} href={`/trabajos/${r.id}`} className="grid gap-1 rounded-md border bg-card px-2.5 py-2 transition-colors hover:border-foreground/30">
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                                <span className={cn("font-mono text-[11px]", r.late ? "text-danger" : "text-muted-foreground")}>{formatDay(r.dueDate, { weekday: "short", day: "numeric" })}</span>
                              </span>
                              <span className="truncate text-xs">{r.course ?? r.clientName}</span>
                              <span className="flex flex-wrap gap-1">
                                <StatusBadge status={r.status} />
                                <UrgencyBadge urgency={r.urgency} />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!people.length && (
              <tr>
                <td colSpan={buckets.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                  No hay trabajos en curso.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
