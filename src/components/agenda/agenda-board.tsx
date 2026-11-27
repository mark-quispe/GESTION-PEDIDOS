"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import type { JobRow } from "@/lib/queries/jobs";
import { initials } from "@/lib/domain";
import { addDays, dayKey, dayLabel, timeLima } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TakeButton } from "@/components/jobs/bits";

type Person = { id: string; name: string; ext: boolean; open: number; doneWeek: number };

const fRange = (a: string, b: string) => {
  const m = (d: string) => new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)).replace(".", "").toLowerCase();
  return m(a) === m(b) ? `${Number(a.slice(8))}–${Number(b.slice(8))} ${m(b)}` : `${Number(a.slice(8))} ${m(a)} – ${Number(b.slice(8))} ${m(b)}`;
};

/** RF-41: la cuadrícula va solo por días; arriba los sin tomar y debajo los demás. */
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
  hint: string | null;
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

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="mb-1.5 font-mono text-xs text-muted">04 · Agenda</p>
          <h1 className="text-[28px] leading-tight font-medium tracking-[-0.025em] md:text-[30px]">Agenda</h1>
          <p className="mt-1 text-sm text-muted">Qué entrega cada responsable: lo ya entregado, lo de hoy y lo que viene.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon" aria-label="Semana anterior" onClick={() => go(addDays(center, -7))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center font-mono text-[13px] text-muted">{fRange(days[0], days[6])}</span>
          <Button size="icon" aria-label="Semana siguiente" onClick={() => go(addDays(center, 7))}>
            <ChevronRight />
          </Button>
          <Button size="md" onClick={() => go(today)} disabled={center === today}>
            Hoy
          </Button>
        </div>
      </header>

      {hint && (
        <p className="enter flex items-center gap-2.5 rounded-lg border border-success-line bg-success-soft px-4 py-2.5 text-[13px]">
          <Lightbulb className="size-4 text-success" />
          {hint}
        </p>
      )}

      <section className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[1080px] grid-cols-[repeat(8,minmax(0,1fr))] gap-2">
          <div className="rounded-lg border border-danger-line bg-[color-mix(in_srgb,var(--danger)_4%,transparent)] px-2.5 py-2 text-[13px] font-medium text-danger">Atrasados</div>
          {days.map((d) => (
            <div key={d} className={cn("rounded-lg border px-2.5 py-2 text-[13px] font-medium", d === today ? "border-fg bg-surface" : "bg-surface-a", d < today && "text-faint")}>
              {dayLabel(d)}
              {d === today && " · hoy"}
            </div>
          ))}
          <Column tone="late">
            {late.map((r, i) => (
              <JobCard key={r.id} r={r} dim={!mine(r)} canTake={canTake} i={i} />
            ))}
          </Column>
          {days.map((d) => (
            <Column key={d} today={d === today}>
              {sortDay(rows.filter((r) => dayKey(r.dueAt) === d)).map((r, i) => (
                <JobCard key={r.id} r={r} dim={!mine(r)} canTake={canTake} i={i} />
              ))}
            </Column>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <Legend cls="border bg-surface">Pendiente</Legend>
        <Legend cls="border border-dashed bg-transparent">Finalizado</Legend>
        <Legend cls="border border-danger-line bg-danger-soft">Atrasado</Legend>
        <Legend cls="border border-dashed border-warning bg-transparent">Sin tomar · pasa el mouse para tomarlo</Legend>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full border bg-surface text-[8.5px] font-semibold">AT</span>
          Quién lo tiene
        </span>
      </div>

      <section aria-label="Producción" className="rounded-lg border bg-surface p-3.5">
        <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className="font-medium">Producción · quién tiene qué</span>
          {sel ? (
            <span className="text-muted">
              Viendo solo los de {sel.name} ·{" "}
              <button type="button" onClick={() => setWho(null)} className="text-info">
                Ver todos
              </button>
            </span>
          ) : (
            <span className="text-faint">Clic en una persona para ver solo sus trabajos · se ilumina quien tiene trabajos tomados</span>
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
                  "press flex items-center gap-2.5 rounded-lg border bg-bg py-2 pr-3 pl-2 text-left transition-[opacity,border-color] duration-200",
                  who === p.id && "border-fg",
                  who && who !== p.id && "opacity-45",
                )}
              >
                <span className={cn("grid size-7 place-items-center rounded-full border bg-surface text-[10px] font-semibold", p.ext && "border-dashed")}>{initials(p.name)}</span>
                <span>
                  <span className="block text-[13px] font-medium">
                    {p.name}
                    {p.ext && <span className="ml-1 text-[11px] font-normal text-faint">externo</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {p.open} en curso
                    <span className="flex gap-[3px]">
                      {Array.from({ length: Math.min(6, p.open) }).map((_, i) => (
                        <span key={i} className="h-2.5 w-1 rounded-[1px] bg-fg" />
                      ))}
                    </span>
                    {p.doneWeek > 0 && (
                      <span className="text-success" title={`${p.doneWeek} entregado esta semana`}>
                        ✓ {p.doneWeek}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ) : (
              <div key={p.id} title="No tiene trabajos tomados" className="flex items-center gap-2.5 rounded-lg border border-dashed py-2 pr-3 pl-2 text-faint">
                <span className="grid size-7 place-items-center rounded-full border border-dashed text-[10px] font-semibold">{initials(p.name)}</span>
                <span>
                  <span className="block text-[13px]">{p.name}</span>
                  <span className="block text-xs">Sin trabajos tomados</span>
                </span>
              </div>
            ),
          )}
        </div>
      </section>
    </>
  );
}

function Column({ children, tone, today }: { children: React.ReactNode; tone?: "late"; today?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] flex-col gap-1.5 rounded-lg border p-1.5",
        tone === "late" ? "border-danger-line bg-[color-mix(in_srgb,var(--danger)_4%,transparent)]" : today ? "border-border-strong bg-surface-a" : "border-line bg-surface-a/60",
      )}
    >
      {children}
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-5 rounded-[3px]", cls)} />
      {children}
    </span>
  );
}

function JobCard({ r, dim, canTake, i }: { r: JobRow; dim: boolean; canTake: boolean; i: number }) {
  const done = r.status === "finalizado";
  const unassigned = !r.responsibleId && !r.externoId && !done;
  const who = r.responsibleName ?? r.externoName;
  const missing = unassigned && r.itemsDone > 0 && r.itemsDone < r.itemsTotal;
  return (
    <Link
      href={`/trabajos/${r.code}`}
      style={{ "--i": i } as React.CSSProperties}
      className={cn(
        "enter reveal row relative flex flex-col gap-0.5 rounded-md border px-2 py-1.5 transition-opacity duration-200",
        done ? "border-dashed bg-transparent" : unassigned ? "border-dashed border-warning bg-transparent" : r.late ? "border-danger-line bg-surface" : "bg-surface",
        dim && "opacity-30",
      )}
    >
      <span className="flex items-center justify-between gap-1 font-mono text-[11px]">
        <span className={done ? "text-faint" : "text-muted"}>{r.code}</span>
        {r.late ? (
          <span className="text-danger">+{r.lateDays} d</span>
        ) : done ? (
          <span className="inline-flex items-center gap-0.5 text-success">
            <Check className="size-3" />
            {r.finishedAt ? timeLima(r.finishedAt) : ""}
          </span>
        ) : (
          <span className={r.urgency === "urgente" ? "text-danger" : r.urgency === "alta" ? "text-warning" : "text-muted"}>{timeLima(r.dueAt)}</span>
        )}
      </span>
      <span className={cn("flex items-center justify-between gap-1.5 text-[12.5px]", done && "text-muted")}>
        <span className="truncate">{r.clientName}</span>
        {who && (
          <span title={who} className={cn("grid size-5 shrink-0 place-items-center rounded-full border bg-bg text-[8.5px] font-semibold", r.externoId && "border-dashed")}>
            {initials(who)}
          </span>
        )}
      </span>
      {missing && <span className="text-[11px] text-warning">falta {r.itemsTotal - r.itemsDone} de {r.itemsTotal}</span>}
      {unassigned && canTake && (
        <span className="act absolute right-1.5 bottom-1.5">
          <TakeButton jobId={r.id} size="sm" />
        </span>
      )}
    </Link>
  );
}
