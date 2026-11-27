import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, jobs, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { actionLabel, auditDetail, entityLabel } from "@/lib/audit-format";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";

export const metadata: Metadata = { title: "Historial" };

const ENTITIES = ["trabajo", "pago", "cliente", "archivo", "usuario", "responsable", "servicio", "configuracion", "importacion"];
const PAGE = 100;

/** RF-21: quién cambió qué y cuándo. */
export default async function HistoryPage({ searchParams }: PageProps<"/admin/historial">) {
  await requireUser("admin");
  const sp = await searchParams;
  const entity = typeof sp.tipo === "string" && ENTITIES.includes(sp.tipo) ? sp.tipo : "";
  const before = typeof sp.antes === "string" && !Number.isNaN(Date.parse(sp.antes)) ? new Date(sp.antes) : null;
  const rows = await db
    .select({ a: auditLog, who: users.name, whoEmail: users.email, code: jobs.code })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .leftJoin(jobs, eq(jobs.id, auditLog.jobId))
    .where(and(entity ? eq(auditLog.entity, entity) : undefined, before ? lt(auditLog.createdAt, before) : undefined))
    .orderBy(desc(auditLog.createdAt))
    .limit(PAGE);
  const last = rows.at(-1)?.a.createdAt;

  return (
    <>
      <PageHeader index="Administración" title="Historial de cambios" description="Estados, precios, pagos y todo lo demás: quién, qué y cuándo.">
        <form className="flex gap-2">
          <NativeSelect name="tipo" defaultValue={entity} aria-label="Tipo" className="w-auto">
            <option value="">Todo</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {entityLabel(e)}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
      </PageHeader>
      <ol className="divide-y rounded-lg border bg-card">
        {rows.map(({ a, who, whoEmail, code }) => (
          <li key={a.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
            <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</span>
            <span className="min-w-0">
              <span className="font-medium">{who ?? whoEmail ?? "Sistema"}</span> {actionLabel(a.action)} · {entityLabel(a.entity)}
              {code && a.jobId && (
                <>
                  {" "}
                  <Link href={`/trabajos/${a.jobId}`} className="font-mono text-xs underline-offset-4 hover:underline">
                    {code}
                  </Link>
                </>
              )}
              {a.source !== "sistema" && <span className="text-muted-foreground"> · desde {a.source}</span>}
              <span className="block truncate text-xs text-muted-foreground">{auditDetail(a.action, a.before, a.after)}</span>
            </span>
          </li>
        ))}
        {!rows.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sin cambios registrados.</li>}
      </ol>
      {rows.length === PAGE && last && (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/admin/historial?${new URLSearchParams({ ...(entity ? { tipo: entity } : {}), antes: last.toISOString() })}`}>Ver más antiguos</Link>
          </Button>
        </div>
      )}
    </>
  );
}
