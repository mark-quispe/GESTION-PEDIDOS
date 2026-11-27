"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { grantAccess, revokeAccess, setRoles } from "@/actions/users";
import type { Role } from "@/db/schema";
import { initials } from "@/lib/domain";
import { dayKey, timeAgo, todayLima } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { HoldButton } from "@/components/ui/hold-button";

export type UserRow = { id: string; name: string; email: string; roles: Role[]; active: boolean; lastLoginAt: string | null; createdAt: string };

const ROLE_COLS: { role: Role; label: string }[] = [
  { role: "empleado", label: "Empleado" },
  { role: "produccion", label: "Producción" },
  { role: "admin", label: "Admin" },
];

const COLS = "grid-cols-[minmax(0,1fr)_270px_130px_130px]";

/** Usuarios (RF-04), igual al Design final «Usuarios · roles con interruptores». */
export function UsersBoard({ rows, meId }: { rows: UserRow[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [newRoles, setNewRoles] = useState<Role[]>(["empleado"]);
  const active = rows.filter((r) => r.active);
  const admins = active.filter((r) => r.roles.includes("admin"));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else toast.success(ok);
      router.refresh();
    });

  const toggleNew = (role: Role) =>
    setNewRoles((prev) => {
      if (role === "admin") return prev.includes("admin") ? ["empleado"] : ["admin"];
      const base = prev.filter((r) => r !== "admin");
      const next = base.includes(role) ? base.filter((r) => r !== role) : [...base, role];
      return next.length ? next : prev;
    });

  const toggleUser = (u: UserRow, role: Role) => {
    let next: Role[];
    if (role === "admin") next = u.roles.includes("admin") ? ["empleado"] : ["admin"];
    else {
      const base = u.roles.filter((r) => r !== "admin");
      next = base.includes(role) ? base.filter((r) => r !== role) : [...base, role];
      if (!next.length) return toast.error("Debe tener al menos un rol.");
    }
    run(() => setRoles(u.id, next), "Roles actualizados.");
  };

  return (
    <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_330px] [&_*]:leading-[normal]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <section className="enter flex flex-col gap-3 rounded-lg border bg-surface px-[18px] py-4">
          <div>
            <h3 className="text-sm font-medium">Dar acceso</h3>
            <p className="mt-1 text-[13px] text-muted">La persona entra con ese Gmail. Solo los correos de esta lista pueden entrar.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => grantAccess({ email, roles: newRoles }), `${email} ya puede entrar.`);
              setEmail("");
            }}
            className="grid items-center gap-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <label className="flex h-10 items-center gap-2.5 rounded-md border bg-bg px-3 text-sm focus-within:border-muted">
              <Mail className="size-4 text-faint" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="correo@gmail.com" aria-label="Correo" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
            </label>
            <span className="inline-flex gap-[18px] px-1.5">
              {ROLE_COLS.map((c) => {
                const on = newRoles.includes(c.role) || (c.role !== "admin" && newRoles.includes("admin"));
                return (
                  <label key={c.role} className={cn("inline-flex items-center gap-2 text-[13px] whitespace-nowrap", on ? "text-fg" : "text-muted")}>
                    <Switch on={on} implied={c.role !== "admin" && newRoles.includes("admin")} onChange={() => toggleNew(c.role)} label={c.label} />
                    {c.label}
                  </label>
                );
              })}
            </span>
            <button type="submit" disabled={pending} className="press h-10 rounded-md bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-45">
              Dar acceso
            </button>
          </form>
        </section>

        <section className="enter overflow-x-auto rounded-lg border bg-surface" style={{ "--i": 1 } as React.CSSProperties}>
          <div className={cn("grid min-w-[760px] gap-4 px-[18px] py-2.5 font-mono text-[11px] text-muted", COLS)}>
            <span>Con acceso · {active.length}</span>
            <span className="grid grid-cols-3 text-center">
              {ROLE_COLS.map((c) => (
                <span key={c.role}>{c.label}</span>
              ))}
            </span>
            <span>Estado</span>
            <span />
          </div>
          {active.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const lastAdmin = isAdmin && admins.length === 1;
            return (
              <div key={u.id} className={cn("row grid min-w-[760px] items-center gap-4 border-t border-line px-[18px] py-3", COLS)}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-[34px] shrink-0 place-items-center rounded-full border bg-line text-[11px] font-semibold">{initials(u.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u.name}
                      {u.id === meId && <span className="ml-1 text-xs font-normal text-muted">tú</span>}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted">{u.email}</p>
                  </div>
                </div>
                <span className="grid grid-cols-3 items-center">
                  {ROLE_COLS.map((c) => {
                    const on = u.roles.includes(c.role) || (c.role !== "admin" && isAdmin);
                    return (
                      <span key={c.role} className="grid place-items-center">
                        <Switch
                          on={on}
                          implied={c.role !== "admin" && isAdmin}
                          disabled={pending || (c.role !== "admin" && isAdmin) || (c.role === "admin" && lastAdmin)}
                          onChange={() => toggleUser(u, c.role)}
                          label={`${c.label} · ${u.name}`}
                        />
                      </span>
                    );
                  })}
                </span>
                <span className="inline-flex items-center gap-2 text-[13px]">
                  <span className={cn("size-[7px] shrink-0 rounded-full", u.lastLoginAt ? "bg-success" : "border-[1.5px] border-warning")} />
                  <span className="flex flex-col">
                    <span>{u.lastLoginAt ? "Activo" : "Aún no entra"}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {u.lastLoginAt ? (u.id === meId ? "ahora" : timeAgo(u.lastLoginAt)) : `autorizad${u.name.trim().endsWith("a") ? "a" : "o"} ${dayKey(u.createdAt) === todayLima() ? "hoy" : timeAgo(u.createdAt)}`}
                    </span>
                  </span>
                </span>
                <div className="text-right">
                  {lastAdmin ? (
                    <span title="No se puede quitar al único administrador" className="inline-flex items-center gap-1.5 text-xs text-faint">
                      <Lock className="size-3" /> Único admin
                    </span>
                  ) : (
                    u.id !== meId && (
                      <HoldButton onConfirm={() => run(() => revokeAccess(u.id), `${u.name} ya no puede entrar.`)} className="h-8 px-3 text-[13px]">
                        Quitar acceso
                      </HoldButton>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </section>
        <p className="text-xs !leading-[1.5] text-faint">
          Para quitar el acceso, mantén presionado el botón rojo 2 segundos. No borra nada: lo que esa persona registró se queda con su nombre. Admin incluye todo, por eso al activarlo los otros dos quedan marcados en gris. Puede haber más de un admin; el último no se puede quitar.
        </p>
      </div>

      <RolesTable />
    </div>
  );
}

/** «Qué puede cada rol» (tabla 2.1 de los requerimientos v0.9). */
function RolesTable() {
  const rows: [string, boolean, boolean, boolean][] = [
    ["Ver trabajos, clientes y precios", true, true, true],
    ["Registrar clientes, trabajos y pagos", true, true, true],
    ["Tomar y soltar trabajos", true, false, true],
    ["Encargar un trabajo a un externo", true, true, true],
    ["Marcar En proceso y Terminado", true, true, true],
    ["Subir y ver archivos", true, true, true],
    ["Revisar, corregir o anular pagos", true, false, false],
    ["Editar trabajos cerrados", true, false, false],
    ["Usuarios, historial, datos y Drive", true, false, false],
  ];
  return (
    <section className="enter rounded-lg border bg-surface px-[18px] py-4" style={{ "--i": 2 } as React.CSSProperties}>
      <h3 className="mb-1 text-sm font-medium">Qué puede cada rol</h3>
      <p className="mb-2.5 text-xs !leading-[1.45] text-muted">Con dos roles se suman los permisos.</p>
      <div className="grid grid-cols-[minmax(0,1fr)_40px_40px_40px] items-center gap-x-1.5 text-[13px]">
        <span />
        {["Admin", "Empl.", "Prod."].map((h) => (
          <span key={h} className="pb-1.5 text-center font-mono text-[10px] text-muted">
            {h}
          </span>
        ))}
        {rows.map(([label, a, e, p]) => (
          <Row key={label} label={label} cells={[a, e, p]} />
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">Nadie pone a otra persona del estudio como responsable: los trabajos van a Por tomar.</p>
    </section>
  );
}

function Row({ label, cells }: { label: string; cells: boolean[] }) {
  return (
    <>
      <span className="border-t border-line py-2 text-fg-2">{label}</span>
      {cells.map((c, i) => (
        <span key={i} className="grid place-items-center border-t border-line py-2">
          {c ? <Check className="size-3.5 text-fg" strokeWidth={2.2} /> : <span className="text-[#4a4a4a]">—</span>}
        </span>
      ))}
    </>
  );
}
