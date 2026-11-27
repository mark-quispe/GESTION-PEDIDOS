"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { ClientRow } from "@/lib/queries/clients";
import { formatPhone, initials, normalizeText } from "@/lib/domain";
import { dayMonth } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/jobs/bits";
import { useSearchKey } from "@/components/jobs/job-list";
import { ClientFormDialog } from "@/components/clients/client-dialogs";

type Tab = "todos" | "pendiente" | "curso";

/** Lista de clientes (RF-06): buscar por nombre o número, con lo que deben. */
export function ClientList({ rows }: { rows: ClientRow[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("todos");
  const [creating, setCreating] = useState(false);
  const search = useSearchKey();
  const activeId = pathname.split("/")[2];
  const onDetail = !!activeId;

  const visible = useMemo(() => {
    const term = normalizeText(q);
    const digits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (tab === "pendiente" && r.pending <= 0) return false;
      if (tab === "curso" && r.open === 0) return false;
      if (!term) return true;
      return normalizeText(r.name).includes(term) || (digits.length >= 3 && r.whatsapp.includes(digits));
    });
  }, [rows, q, tab]);

  const groups = useMemo(() => {
    const m = new Map<string, ClientRow[]>();
    for (const r of visible) {
      const k = normalizeText(r.name).charAt(0).toUpperCase() || "#";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [visible]);

  return (
    <section aria-label="Lista de clientes" className={cn("flex min-h-0 w-full shrink-0 flex-col border-r bg-side/60 md:sticky md:top-0 md:h-dvh md:w-[340px]", onDetail && "hidden md:flex")}>
      <header className="flex flex-col gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-1 font-mono text-[11px] text-muted">03 · Clientes</p>
            <h1 className="text-[28px] font-medium tracking-[-0.02em]">Clientes</h1>
          </div>
          <Button variant="primary" size="md" onClick={() => setCreating(true)}>
            <Plus /> Nuevo
          </Button>
        </div>
        <label className="flex h-[38px] items-center gap-2 rounded-md border bg-surface px-3 text-muted focus-within:border-muted">
          <Search className="size-4 shrink-0" strokeWidth={1.8} />
          <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o WhatsApp" aria-label="Buscar clientes" className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
          <Kbd className="hidden md:inline-flex">/</Kbd>
        </label>
        <div role="tablist" aria-label="Qué clientes ver" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {(
            [
              ["todos", `Todos ${rows.length}`],
              ["pendiente", `Con pendiente ${rows.filter((r) => r.pending > 0).length}`],
              ["curso", `Con trabajo en curso ${rows.filter((r) => r.open > 0).length}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("press h-8 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150", tab === k ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto border-t border-line pb-24 md:pb-4">
        {groups.length === 0 && <p className="px-5 py-10 text-center text-sm text-faint">{q ? `Nadie coincide con «${q}».` : "Todavía no hay clientes."}</p>}
        {groups.map(([letter, list]) => (
          <div key={letter}>
            <p className="px-5 pt-3 pb-1 font-mono text-[11px] text-faint">{letter}</p>
            {list.map((r) => (
              <Link
                key={r.id}
                href={`/clientes/${r.id}`}
                aria-current={r.id === activeId ? "page" : undefined}
                className={cn("row grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2", r.id === activeId && "bg-hover")}
              >
                <span className="grid size-8 place-items-center rounded-full border bg-surface text-[10.5px] font-semibold">{initials(r.name)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.university ? `${r.university} · ` : ""}
                    {formatPhone(r.whatsapp)}
                  </span>
                </span>
                <span className="text-right">
                  {r.pending > 0 ? <span className="block font-mono text-xs text-warning">{formatMoney(r.pending)}</span> : <span className="block font-mono text-xs text-muted">{r.jobs} trab.</span>}
                  <span className="block font-mono text-[11px] text-faint">{r.lastOrder ? dayMonth(r.lastOrder) : "—"}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      <ClientFormDialog open={creating} onOpenChange={setCreating} />
    </section>
  );
}
