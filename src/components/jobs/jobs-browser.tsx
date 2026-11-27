"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Columns3, Rows3, Search } from "lucide-react";
import type { JobStatus } from "@/db/schema";
import { changeJobStatus } from "@/actions/jobs";
import { JOB_STATUSES, STATUS_LABELS, URGENCIES, URGENCY_LABELS } from "@/lib/domain";
import type { JobListRow } from "@/lib/queries";
import { cn, formatDay, formatMoney } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LateBadge, PaymentBadge, STATUS_DOT, STATUS_VARIANT, UrgencyBadge } from "./badges";

export type JobFilters = {
  q: string;
  estado: string;
  responsable: string;
  urgencia: string;
  desde: string;
  hasta: string;
  atrasados: boolean;
  saldo: boolean;
  vista: "lista" | "tablero";
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const helper = createColumnHelper<typeof features, JobListRow>();

export function StatusSelect({ id, code, status: initial, className }: { id: string; code: string; status: JobStatus; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-grid gap-1">
      <NativeSelect
        aria-label={`Estado de ${code}`}
        className={cn(
          badgeVariants({ variant: STATUS_VARIANT[status] }),
          "h-10 w-auto cursor-pointer rounded-md py-0 pr-7 pl-2 text-xs font-medium shadow-none transition-opacity duration-150 sm:h-7",
          pending && "opacity-60",
          className,
        )}
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as JobStatus;
          const prev = status;
          setStatus(next);
          setError(null);
          startTransition(async () => {
            const res = await changeJobStatus({ jobId: id, status: next });
            if (!res.ok) {
              setStatus(prev);
              setError(res.error);
            }
          });
        }}
      >
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

function SortHeader({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={cn("inline-flex min-h-10 items-center gap-1 transition-colors duration-150 hover:text-foreground", className)} onClick={onClick}>
      {label} <ArrowUpDown className="size-3" />
    </button>
  );
}

function DueCell({ row }: { row: JobListRow }) {
  return (
    <span className={cn("font-mono text-xs", row.late ? "text-danger" : "text-muted-foreground")}>
      {formatDay(row.dueDate, { weekday: "short", day: "numeric", month: "short" })}
    </span>
  );
}

export function JobsBrowser({ data, responsables, initial }: { data: JobListRow[]; responsables: { id: string; name: string }[]; initial: JobFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(initial);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Los filtros quedan en la dirección: se pueden compartir o recargar.
  const update = (patch: Partial<JobFilters>) => {
    const next = { ...f, ...patch };
    setF(next);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (k === "vista" ? v === "tablero" : v) params.set(k, v === true ? "1" : String(v));
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return data.filter(
      (r) =>
        (!f.estado || r.status === f.estado) &&
        (!f.responsable || (f.responsable === "sin" ? !r.responsableId : r.responsableId === f.responsable)) &&
        (!f.urgencia || r.urgency === f.urgencia) &&
        (!f.desde || (r.dueDate ?? "") >= f.desde) &&
        (!f.hasta || (!!r.dueDate && r.dueDate <= f.hasta)) &&
        (!f.atrasados || r.late) &&
        (!f.saldo || r.balance > 0) &&
        (!q ||
          r.code.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.course ?? "").toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)),
    );
  }, [data, f]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("code", {
          header: ({ column }) => <SortHeader label="Código" onClick={() => column.toggleSorting()} />,
          cell: ({ row }) => (
            <Link href={`/trabajos/${row.original.id}`} className="font-mono text-xs underline-offset-4 hover:underline">
              {row.original.code}
            </Link>
          ),
        }),
        helper.accessor("clientName", {
          header: ({ column }) => <SortHeader label="Cliente y curso" onClick={() => column.toggleSorting()} />,
          cell: ({ row }) => (
            <Link href={`/trabajos/${row.original.id}`} className="block max-w-72 min-w-44">
              <span className="block truncate font-medium">{row.original.clientName}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.original.course ?? row.original.description}</span>
            </Link>
          ),
        }),
        helper.accessor("status", {
          header: "Estado",
          enableSorting: false,
          cell: ({ row }) => (
            <span className="flex items-center gap-1.5">
              <StatusSelect key={row.original.status} id={row.original.id} code={row.original.code} status={row.original.status} />
              {row.original.late && <LateBadge />}
              <UrgencyBadge urgency={row.original.urgency} />
            </span>
          ),
        }),
        helper.accessor((r) => r.dueDate ?? "9999", {
          id: "dueDate",
          header: ({ column }) => <SortHeader label="Entrega" onClick={() => column.toggleSorting()} />,
          cell: ({ row }) => <DueCell row={row.original} />,
        }),
        helper.accessor((r) => r.responsable ?? "", {
          id: "responsable",
          header: "Responsable",
          enableSorting: false,
          cell: ({ row }) => <span className="text-muted-foreground">{row.original.responsable ?? "—"}</span>,
        }),
        helper.accessor((r) => r.balance, {
          id: "balance",
          header: ({ column }) => (
            <div className="text-right">
              <SortHeader label="Precio · saldo" onClick={() => column.toggleSorting()} />
            </div>
          ),
          cell: ({ row: { original: r } }) => (
            <div className="grid justify-items-end gap-1 text-right">
              <span className="tabular-nums">{formatMoney(r.price)}</span>
              {r.price !== null && r.status !== "cancelado" && (r.balance > 0 ? <span className="text-xs text-muted-foreground tabular-nums">Debe {formatMoney(r.balance)}</span> : <PaymentBadge status={r.paymentStatus} />)}
            </div>
          ),
        }),
      ]),
    [],
  );

  const table = useTable({ features, columns, data: filtered, state: { sorting }, onSortingChange: setSorting });
  const rows = table.getRowModel().rows;
  const active = [f.estado, f.responsable, f.urgencia, f.desde, f.hasta, f.atrasados, f.saldo].filter(Boolean).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar" placeholder="Código, cliente o curso" value={f.q} onChange={(e) => update({ q: e.target.value })} className="pl-9" />
        </label>
        <NativeSelect aria-label="Estado" className="w-auto" value={f.estado} onChange={(e) => update({ estado: e.target.value })}>
          <option value="">Todos los estados</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Responsable" className="w-auto" value={f.responsable} onChange={(e) => update({ responsable: e.target.value })}>
          <option value="">Todos los responsables</option>
          <option value="sin">Sin responsable</option>
          {responsables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Urgencia" className="w-auto" value={f.urgencia} onChange={(e) => update({ urgencia: e.target.value })}>
          <option value="">Toda urgencia</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABELS[u]}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-1">
          <Input type="date" aria-label="Entrega desde" className="w-auto" value={f.desde} onChange={(e) => update({ desde: e.target.value })} />
          <span className="text-xs text-muted-foreground">a</span>
          <Input type="date" aria-label="Entrega hasta" className="w-auto" value={f.hasta} onChange={(e) => update({ hasta: e.target.value })} />
        </div>
        <div className="ml-auto inline-flex rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label="Vista">
          {(
            [
              ["lista", "Lista", Rows3],
              ["tablero", "Tablero", Columns3],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={f.vista === v}
              onClick={() => update({ vista: v })}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground sm:h-8",
                f.vista === v && "bg-card text-foreground shadow-xs",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ["atrasados", "Solo atrasados"],
            ["saldo", "Con saldo pendiente"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={f[k]}
            onClick={() => update({ [k]: !f[k] })}
            className={cn(
              "h-10 rounded-full border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground sm:h-7",
              f[k] && "border-foreground/40 bg-accent text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} de {data.length}
        </span>
        {active > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => update({ estado: "", responsable: "", urgencia: "", desde: "", hasta: "", atrasados: false, saldo: false })}
          >
            Quitar filtros
          </button>
        )}
      </div>

      {f.vista === "tablero" ? (
        <Board rows={filtered} />
      ) : (
        <>
          <ul className="grid gap-2 md:hidden">
            {rows.map(({ original: r }) => (
              <li key={r.id} className="grid gap-3 rounded-lg border bg-card p-4">
                <Link href={`/trabajos/${r.id}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">{r.code}</span>
                    <span className="block truncate font-medium">{r.clientName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.course ?? r.description}</span>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <span className="tabular-nums">{formatMoney(r.price)}</span>
                    <DueCell row={r} />
                  </span>
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusSelect key={r.status} id={r.id} code={r.code} status={r.status} />
                  {r.late && <LateBadge />}
                  <UrgencyBadge urgency={r.urgency} />
                  {r.price !== null && r.status !== "cancelado" && <PaymentBadge status={r.paymentStatus} />}
                </div>
              </li>
            ))}
            {!rows.length && <li className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No hay trabajos con estos filtros.</li>}
          </ul>
          <Table className="max-md:hidden">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{h.isPlaceholder ? null : <table.FlexRender header={h} />}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No hay trabajos con estos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}

/** RF-12: una columna por estado. */
function Board({ rows }: { rows: JobListRow[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid min-w-max auto-cols-[16rem] grid-flow-col gap-3">
        {JOB_STATUSES.map((s) => {
          const items = rows.filter((r) => r.status === s);
          return (
            <section key={s} aria-label={STATUS_LABELS[s]} className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-2">
              <header className="flex items-center gap-2 px-2 pt-1 pb-1.5">
                <span aria-hidden className={`size-2 rounded-full ${STATUS_DOT[s]}`} />
                <h2 className="text-sm font-medium">{STATUS_LABELS[s]}</h2>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{items.length}</span>
              </header>
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/trabajos/${r.id}`}
                  className="grid gap-2 rounded-md border bg-card p-3 transition-[border-color,transform] duration-150 ease-(--ease-out) hover:border-foreground/30 active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                    <DueCell row={r} />
                  </span>
                  <span>
                    <span className="block text-sm leading-snug font-medium">{r.clientName}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.course ?? r.description}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                    {r.late && <LateBadge />}
                    <UrgencyBadge urgency={r.urgency} />
                    <span className="ml-auto truncate text-xs text-muted-foreground">{r.responsable ?? "Sin responsable"}</span>
                  </span>
                </Link>
              ))}
              {!items.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vacío</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
