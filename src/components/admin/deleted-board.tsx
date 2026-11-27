"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banknote, FileText, RotateCcw, Search, User } from "lucide-react";
import { toast } from "sonner";
import { restoreRecord } from "@/actions/admin";
import type { DeletedKind, DeletedRow } from "@/lib/queries/deleted";
import { normalizeText } from "@/lib/domain";
import { dayKey, dayMonthNum, timeLima, todayLima, addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

const COLS = "grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1.2fr)_130px_90px_auto]";
const KIND_LABEL: Record<DeletedKind, string> = { trabajo: "Trabajo", pago: "Pago", cliente: "Cliente" };
const ICON = { trabajo: FileText, pago: Banknote, cliente: User };

function when(iso: string) {
  const d = dayKey(iso);
  const t = todayLima();
  if (d === t) return `hoy ${timeLima(iso)}`;
  if (d === addDays(t, -1)) return `ayer ${timeLima(iso)}`;
  return dayMonthNum(iso);
}

/** RF-29: Eliminados, igual al Design final. */
export function DeletedBoard({ rows }: { rows: DeletedRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"todos" | DeletedKind>("todos");
  const [q, setQ] = useState("");
  const [gone, setGone] = useState<string[]>([]);
  const live = rows.filter((r) => !gone.includes(r.id));
  const count = (k: DeletedKind) => live.filter((r) => r.kind === k).length;
  const t = normalizeText(q);
  const shown = live.filter((r) => (tab === "todos" || r.kind === tab) && (!t || normalizeText(r.search).includes(t)));
  const tabs: { v: "todos" | DeletedKind; label: string }[] = [
    { v: "todos", label: `Todos · ${live.length}` },
    { v: "trabajo", label: `Trabajos · ${count("trabajo")}` },
    { v: "pago", label: `Pagos · ${count("pago")}` },
    { v: "cliente", label: `Clientes · ${count("cliente")}` },
  ];

  const restore = (r: DeletedRow) =>
    start(async () => {
      const res = await restoreRecord(r.kind, r.id);
      if (!res.ok) return void toast.error(res.error);
      setGone((g) => [...g, r.id]);
      toast.success(`${KIND_LABEL[r.kind]} ${r.title} restaurado.`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-[18px] [&_*]:leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-[7px] border bg-surface p-[3px]">
          {tabs.map((x) => (
            <button
              key={x.v}
              role="radio"
              aria-checked={tab === x.v}
              onClick={() => setTab(x.v)}
              className={cn("press h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors", tab === x.v ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="flex h-9 w-[320px] max-w-full items-center gap-2 rounded-md border bg-bg px-3 text-[13px] focus-within:border-muted">
          <Search className="size-3.5 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, cliente o monto" aria-label="Buscar en eliminados" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
        </label>
      </div>

      <section className="enter overflow-x-auto rounded-lg border bg-surface">
        <div className={cn("grid min-w-[860px] items-center gap-3.5 px-[18px] py-2.5 font-mono text-[11px] text-muted", COLS)}>
          <span />
          <span>Registro</span>
          <span>Motivo</span>
          <span>Lo eliminó</span>
          <span>Cuándo</span>
          <span />
        </div>
        {shown.map((r) => {
          const Icon = ICON[r.kind];
          return (
            <div key={r.id} className={cn("row grid min-w-[860px] items-center gap-3.5 border-t border-line px-[18px] py-[11px] text-sm", COLS)}>
              <span className="grid size-7 place-items-center rounded-md bg-line text-muted">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className={cn("font-medium", r.kind !== "cliente" && "font-mono text-[13px]")}>{r.title}</span>
                  <span className="text-xs text-faint">{KIND_LABEL[r.kind]}</span>
                </p>
                <p className="mt-px truncate text-xs text-muted">{r.sub}</p>
              </div>
              <span className="truncate text-[13px] text-muted italic">{r.reason ? `“${r.reason}”` : <span className="not-italic text-faint">sin motivo</span>}</span>
              <span className="text-[13px] text-muted">{r.by ?? "—"}</span>
              <span className="font-mono text-xs text-muted">{when(r.at)}</span>
              <button disabled={pending} onClick={() => restore(r)} className="press inline-flex h-[30px] items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[13px] font-medium disabled:opacity-50">
                <RotateCcw className="size-3.5" /> Restaurar
              </button>
            </div>
          );
        })}
        {shown.length === 0 && <p className="border-t border-line px-[18px] py-10 text-center text-[13px] text-muted">{live.length ? "Nada coincide con la búsqueda." : "No hay nada eliminado."}</p>}
      </section>
      <p className="text-xs text-faint">Al restaurar un trabajo vuelve con sus pagos y su carpeta de Drive. Al restaurar un pago, lo pendiente del trabajo se recalcula.</p>
    </div>
  );
}
