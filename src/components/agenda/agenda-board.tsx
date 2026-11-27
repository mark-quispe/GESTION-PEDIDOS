"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JobRow } from "@/lib/queries/jobs";
import { initials } from "@/lib/domain";
import { addDays, dayKey, dayLabel, timeLima } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TakeButton } from "@/components/jobs/bits";

type Person = { id: string; name: string; ext: boolean; open: number; doneWeek: number };

const fRange = (a: string, b: string) => {
  const m = (d: string) => new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)).replace(".", "").toLowerCase();
  return m(a) === m(b) ? `${Number(a.slice(8))}–${Number(b.slice(8))} ${m(b)}` : `${Number(a.slice(8))} ${m(a)} – ${Number(b.slice(8))} ${m(b)}`;
};

/**
 * Agenda (RF-41), igual al Design final «Agenda · administrador»:
 * un solo tablero de 8 columnas (Atrasados + 7 días con hoy al medio)
 * separadas por líneas finas; sin tomar arriba con borde ámbar punteado.
 */
export function AgendaBoard({
  days,
  today,
  center,
  rows,
  late,
  people,
  canTake,
  hint,
}: {
  days: string[];
  today: string;
  center: string;
  rows: JobRow[];
  late: JobRow[];
  people: Person[];
  canTake: boolean;
  hint: { name: string; rest: string } | null;
}) {
  const router = useRouter();
  const [who, setWho] = useState<string | null>(null);
  const go = (d: string) => router.push(d === today ? "/agenda" : `/agenda?d=${d}`);
  const mine = (r: JobRow) => !who || r.responsibleId === who || r.externoId === who;
  const sel = people.find((p) => p.id === who);

  const sortDay = (list: JobRow[]) => {
    const pool = list.filter((r) => !r.responsibleId && !r.externoId && r.status !== "finalizado");
    const rest = list.filter((r) => !pool.includes(r));
    return [...pool.sort((a, b) => a.dueAt.localeCompare(b.dueAt)), ...rest.sort((a, b) => a.dueAt.localeCompare(b.dueAt))];
  };

  const navBtn = "press grid size-[34px] place-items-center rounded-md border bg-surface text-muted hover-fine:hover:text-fg";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-muted">04 · Agenda</p>
          <h1 className="mt-2 mb-1 text-[32px] leading-tight font-medium tracking-[-0.025em]">Agenda</h1>
          <p className="text-sm text-muted">Qué entrega cada responsable: lo ya entregado, lo de hoy y lo que viene.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Semana anterior" onClick={() => go(addDays(center, -7))} className={navBtn}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1.5 font-mono text-[13px] whitespace-nowrap">{fRange(days[0], days[6])}</span>
          <button type="button" aria-label="Semana siguiente" onClick={() => go(addDays(center, 7))} className={navBtn}>
            <ChevronRight className="size-4" />
          </button>
          <button type="button" onClick={() => go(today)} className="press h-[34px] rounded-md border bg-surface px-3 text-[13px] font-medium">
            Hoy
          </button>
        </div>
      </header>

      {hint && (
        <div className="enter flex items-center gap-3.5 rounded-lg border bg-surface px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-success" />
          <p className="flex-1 text-sm">
            <span className="font-medium">{hint.name} tiene más espacio esta semana.</span> <span className="text-muted">{hint.rest}</span>
          </p>
        </div>
      )}

      <section className="enter -mx-4 flex min-h-[420px] flex-1 flex-col overflow-x-auto md:mx-0" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="mx-4 flex min-w-[1000px] flex-1 flex-col overflow-hidden rounded-lg border bg-surface md:mx-0">
          <div className="grid grid-cols-8 border-b">
            <div className="bg-danger/[0.04] px-2 py-2.5">
              <p className="font-mono text-[11px] text-danger">Atrasados</p>
            </div>
            {days.map((d) => (
              <div key={d} className={cn("border-l border-line px-2 py-2.5", d === today && "bg-fg/[0.04]")}>
                <p className={cn("font-mono text-[11px]", d === today ? "text-fg" : d < today ? "text-faint" : "text-muted")}>
                  {dayLabel(d)}
                  {d === today && " · hoy"}
                </p>
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-8">
            <Column className="bg-danger/[0.04]">
              {late.map((r) => (
                <JobCard key={r.id} r={r} dim={!mine(r)} canTake={canTake} />
              ))}
            </Column>
            {days.map((d) => (
              <Column key={d} className={cn("border-l border-line", d === today && "bg-fg/[0.04]")}>
                {sortDay(rows.filter((r) => dayKey(r.dueAt) === d)).map((r) => (
                  <JobCard key={r.id} r={r} dim={!mine(r)} canTake={canTake} />
                ))}
              </Column>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-x-[18px] gap-y-2 text-xs text-muted">
        <Swatch className="border border-l-2 border-border border-l-info bg-surface">Pendiente</Swatch>
        <Swatch className="border border-dashed border-[#4a4a4a]">Finalizado</Swatch>
        <Swatch className="border border-l-2 border-border border-l-danger">Atrasado</Swatch>
        <Swatch className="border border-dashed border-warning/60">Sin tomar · pasa el mouse para tomarlo</Swatch>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded-full border bg-line text-[7px] font-semibold text-fg">AT</span>
          Quién lo tiene
        </span>
      </div>

      <section aria-label="Producción" className="flex flex-col gap-2">
        <p className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted">
          <span>Producción · quién tiene qué</span>
          {sel ? (
            <span>
              Viendo solo los de {sel.name} ·{" "}
              <button type="button" onClick={() => setWho(null)} className="text-fg">
                Ver todos
              </button>
            </span>
          ) : (
            <span>Clic en una persona para ver solo sus trabajos · se ilumina quien tiene trabajos tomados</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {people.map((p) =>
            p.open > 0 || p.doneWeek > 0 ? (
              <button
                key={p.id}
                type="button"
                aria-pressed={who === p.id}
                onClick={() => setWho(who === p.id ? null : p.id)}
                className={cn(
                  "row flex min-w-[200px] flex-1 items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-[opacity,background-color,border-color] duration-200",
                  who === p.id ? "border-muted bg-line" : "bg-surface",
                  who && who !== p.id && "opacity-55",
                )}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border bg-line text-[10px] font-semibold", p.ext && "border-dashed")}>{initials(p.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {p.name}
                    {p.ext && <span className="ml-1 text-[11px] font-normal text-faint">externo</span>}
                  </span>
                  <span className="mt-[3px] flex items-center gap-2">
                    <span className="font-mono text-[11px] whitespace-nowrap">{p.open} en curso</span>
                    <span aria-hidden className="inline-flex gap-[3px]">
                      {Array.from({ length: Math.max(5, Math.min(8, p.open)) }).map((_, i) => (
                        <span key={i} className={cn("h-1 w-[9px] rounded-sm", i < p.open ? "bg-fg" : "bg-border")} />
                      ))}
                    </span>
                    {p.doneWeek > 0 && (
                      <span title={`${p.doneWeek} entregado${p.doneWeek === 1 ? "" : "s"} esta semana`} className="font-mono text-[11px] whitespace-nowrap text-success">
                        ✓ {p.doneWeek}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ) : (
              <div key={p.id} title="No tiene trabajos tomados" className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-dashed border-line px-3 py-2 text-faint">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-dashed text-[10px] font-semibold">{initials(p.name)}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] whitespace-nowrap">{p.name}</span>
                  <span className="mt-[3px] block font-mono text-[11px]">Sin trabajos tomados</span>
                </span>
              </div>
            ),
          )}
        </div>
      </section>
    </>
  );
}

function Column({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-1.5 px-1.5 py-2", className)}>{children}</div>;
}

function Swatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-3.5 rounded-[2px]", className)} />
      {children}
    </span>
  );
}

function JobCard({ r, dim, canTake }: { r: JobRow; dim: boolean; canTake: boolean }) {
  const done = r.status === "finalizado";
  const unassigned = !r.responsibleId && !r.externoId && !done;
  const who = r.responsibleName ?? r.externoName;
  const missing = unassigned && r.itemsDone > 0 && r.itemsDone < r.itemsTotal;
  const timeTone = r.urgency === "urgente" ? "text-danger" : r.urgency === "alta" ? "text-warning" : "text-muted";
  return (
    <Link
      href={`/trabajos/${r.code}`}
      className={cn(
        "agenda-card row block rounded-md px-2 py-[7px] transition-opacity duration-200",
        done
          ? "border border-dashed border-[#4a4a4a] bg-transparent"
          : unassigned
            ? "agenda-pool border border-dashed border-warning/60 bg-transparent"
            : cn("border border-l-2 bg-surface", r.late ? "border-l-danger" : "border-l-info"),
        dim && "opacity-30",
      )}
    >
      <p className={cn("flex justify-between font-mono text-[10px]", done ? "text-faint" : "text-muted")}>
        <span>{r.code}</span>
        {r.late ? (
          <span className="text-danger">+{r.lateDays} d</span>
        ) : done ? (
          <span className="text-success">✓ {r.finishedAt ? timeLima(r.finishedAt) : ""}</span>
        ) : (
          <span className={unassigned ? "" : timeTone}>{timeLima(r.dueAt)}</span>
        )}
      </p>
      <p className={cn("mt-[3px] flex items-center justify-between gap-1.5 text-xs", done ? "text-muted" : "text-fg")}>
        <span className="truncate">{r.clientName}</span>
        {who && (
          <span title={who} className={cn("grid size-5 shrink-0 place-items-center rounded-full border bg-line text-[8.5px] font-semibold text-fg", r.externoId && "border-dashed")}>
            {initials(who)}
          </span>
        )}
      </p>
      {missing && <p className="mt-0.5 text-[11px] text-warning">falta {r.itemsTotal - r.itemsDone} de {r.itemsTotal}</p>}
      {unassigned && canTake && (
        <div className="agenda-act">
          <TakeButton jobId={r.id} size="sm" />
        </div>
      )}
    </Link>
  );
}
