"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Trash2 } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { deleteOrder, updateOrderStatus } from "@/actions/orders";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/validation/orders";
import { cn, formatDate, formatMoney, orderCode } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type OrderRow = {
  id: string;
  number: number;
  customerName: string;
  status: OrderStatus;
  total: string;
  dueAt: string | null;
  createdAt: string;
  createdBy: string;
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const helper = createColumnHelper<typeof features, OrderRow>();

function StatusSelect({ row }: { row: OrderRow }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(row.status);
  return (
    <NativeSelect
      aria-label={`Estado de ${orderCode(row.number)}`}
      className={cn(
        badgeVariants({ variant: status }),
        "h-10 w-auto cursor-pointer rounded-full py-0 pr-7 pl-3 text-xs font-medium no-underline shadow-none transition-[opacity,background-color] duration-150 sm:h-7",
        pending && "opacity-60",
      )}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as OrderStatus;
        const prev = status;
        setStatus(next);
        startTransition(async () => {
          const res = await updateOrderStatus({ orderId: row.id, status: next });
          if (!res.ok) setStatus(prev);
        });
      }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </NativeSelect>
  );
}

function SortHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="inline-flex min-h-10 items-center gap-1 transition-colors duration-150 hover:text-foreground" onClick={onClick}>
      {label} <ArrowUpDown className="size-3" />
    </button>
  );
}

export function OrdersTable({ data, canDelete }: { data: OrderRow[]; canDelete: boolean }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter(
      (o) =>
        (!statusFilter || o.status === statusFilter) &&
        (!q || o.customerName.toLowerCase().includes(q) || orderCode(o.number).toLowerCase().includes(q)),
    );
  }, [data, statusFilter, search]);

  const confirmDelete = (row: OrderRow) => {
    if (confirm(`¿Eliminar ${orderCode(row.number)}?`)) {
      startTransition(async () => {
        await deleteOrder(row.id);
      });
    }
  };

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: ({ column }) => <SortHeader label="Pedido" onClick={() => column.toggleSorting()} />,
          cell: ({ row }) => <span className="font-mono text-xs">{orderCode(row.original.number)}</span>,
        }),
        helper.accessor("customerName", { header: "Cliente", enableSorting: false }),
        helper.accessor("status", {
          header: "Estado",
          enableSorting: false,
          cell: ({ row }) => <StatusSelect key={row.original.status} row={row.original} />,
        }),
        helper.accessor((o) => Number(o.total), {
          id: "total",
          header: ({ column }) => (
            <div className="text-right">
              <SortHeader label="Total" onClick={() => column.toggleSorting()} />
            </div>
          ),
          cell: ({ row }) => <div className="text-right tabular-nums">{formatMoney(row.original.total)}</div>,
        }),
        helper.accessor((o) => o.dueAt ?? "", {
          id: "dueAt",
          header: ({ column }) => <SortHeader label="Entrega" onClick={() => column.toggleSorting()} />,
          cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.dueAt)}</span>,
        }),
        helper.accessor("createdBy", { header: "Registrado por", enableSorting: false }),
        ...(canDelete
          ? [
              helper.display({
                id: "actions",
                header: "",
                cell: ({ row }) => (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    aria-label="Eliminar pedido"
                    onClick={() => confirmDelete(row.original)}
                  >
                    <Trash2 />
                  </Button>
                ),
              }),
            ]
          : []),
      ]),
    [canDelete],
  );

  const table = useTable({
    features,
    columns,
    data: filtered,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar por cliente o número…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <NativeSelect
          aria-label="Filtrar por estado"
          className="w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
        >
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {/* Móvil: tarjetas. Escritorio: tabla. */}
      <ul className="grid gap-2 md:hidden">
        {table.getRowModel().rows.map(({ original: o }) => (
          <li key={o.id} className="grid gap-2 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{orderCode(o.number)}</p>
                <p className="truncate font-medium">{o.customerName}</p>
              </div>
              <p className="font-medium tabular-nums">{formatMoney(o.total)}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <StatusSelect key={o.status} row={o} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                {o.dueAt && <span className="text-xs whitespace-nowrap">{formatDate(o.dueAt)}</span>}
                {canDelete && (
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar ${orderCode(o.number)}`} onClick={() => confirmDelete(o)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
        {!table.getRowModel().rows.length && (
          <li className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">No hay pedidos todavía.</li>
        )}
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
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
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
                No hay pedidos todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
