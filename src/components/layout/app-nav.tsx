"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ComponentType } from "react";
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Database,
  Ellipsis,
  Eye,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Shapes,
  Trash2,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { logout, setViewAsEmployee } from "@/actions/session";
import { BrandMark, BrandTile } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { initials } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
type Item = { href: string; label: string; icon: Icon };

const MAIN: Item[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/trabajos", label: "Trabajos", icon: ClipboardList },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
];

/** Empleado y Producción ven Servicios en solo lectura, debajo de Agenda. */
const STAFF_EXTRA: Item[] = [{ href: "/servicios", label: "Servicios", icon: Shapes }];

const ADMIN: Item[] = [
  { href: "/pagos", label: "Pagos", icon: Wallet },
  { href: "/estadisticas", label: "Estadísticas", icon: ChartColumn },
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/produccion", label: "Producción", icon: Wrench },
  { href: "/servicios", label: "Servicios", icon: Shapes },
  { href: "/datos", label: "Datos", icon: Database },
  { href: "/eliminados", label: "Eliminados", icon: Trash2 },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export type SystemStatus = {
  ok: boolean;
  label: string;
  drive: string;
  driveOk: boolean;
  backup: string;
  backupOk: boolean;
  contingency: { label: string; href: string | null };
};

export type NavUser = { name: string; roleLabel: string; isAdmin: boolean; viewAsEmployee: boolean; demo: boolean };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "row flex min-h-9 items-center gap-2.5 rounded-md px-3 text-sm",
        active ? "bg-line text-fg" : "text-fg-2 [&_svg]:text-muted",
      )}
    >
      <Icon className="size-4" strokeWidth={1.7} />
      <span>{item.label}</span>
    </Link>
  );
}

/** Ventanita Sistema del menú admin (RF-20, RF-56). */
function SystemCard({ status }: { status: SystemStatus }) {
  return (
    <section aria-label="Estado del sistema" className="flex flex-col gap-2 rounded-lg border bg-surface px-3 py-2.5">
      <header className="flex items-center justify-between border-b border-line pb-2">
        <span className="font-mono text-[11px] text-muted">Sistema</span>
        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span
            aria-hidden
            className={cn("size-[7px] rounded-full", status.ok ? "bg-success shadow-[0_0_0_3px_var(--success-soft)]" : "bg-danger shadow-[0_0_0_3px_var(--danger-soft)]")}
          />
          {status.label}
        </span>
      </header>
      <Row label="Drive" value={status.drive} bad={!status.driveOk} href="/configuracion" />
      <Row label="Respaldo diario" value={status.backup} bad={!status.backupOk} href="/configuracion/respaldo" />
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">Contingencia</span>
        {status.contingency.href ? (
          <a
            href={status.contingency.href}
            target="_blank"
            rel="noreferrer"
            title="Abrir la planilla de contingencia en Drive"
            className="font-mono text-[11px] underline decoration-border-strong underline-offset-[3px]"
          >
            {status.contingency.label}
          </a>
        ) : (
          <span className="font-mono text-[11px] text-faint">{status.contingency.label}</span>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, bad, href }: { label: string; value: string; bad?: boolean; href: string }) {
  return (
    <Link href={href} className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className={cn("font-mono text-[11px]", bad ? "text-danger" : "text-fg")}>{value}</span>
    </Link>
  );
}

function useEyeShortcut(enabled: boolean, viewAsEmployee: boolean) {
  const router = useRouter();
  const [, start] = useTransition();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        start(async () => {
          await setViewAsEmployee(!viewAsEmployee);
          router.refresh();
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, viewAsEmployee, router]);
}

export function Sidebar({ user, studioName, system }: { user: NavUser; studioName: string; system: SystemStatus | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const showAdmin = user.isAdmin && !user.viewAsEmployee;
  useEyeShortcut(user.isAdmin, user.viewAsEmployee);

  const toggleView = () =>
    start(async () => {
      await setViewAsEmployee(!user.viewAsEmployee);
      router.refresh();
    });

  return (
    <nav aria-label="Principal" className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r bg-side px-3.5 py-5 md:flex">
      <BrandTile name={studioName} className="mb-3.5 border-b px-1 pb-[18px]" />
      <div className="scroll-thin -mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-3">
      {MAIN.map((it) => (
        <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
      ))}
      {!showAdmin && STAFF_EXTRA.map((it) => <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />)}
      {showAdmin && (
        <>
          <p className="mt-4 mb-1 px-3 font-mono text-[11px] text-muted">Administración</p>
          {ADMIN.map((it) => (
            <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
          ))}
        </>
      )}
      </div>
      <div className="flex flex-col gap-3 border-t pt-3.5">
        {showAdmin && system && <SystemCard status={system} />}
        <ThemeToggle className="self-start" />
        <div className="flex items-center justify-between gap-1.5">
          <div className="min-w-0 flex-1 leading-snug">
            <p className="truncate text-sm">{user.name}</p>
            <p className={cn("truncate font-mono text-[11px]", user.viewAsEmployee ? "text-info" : "text-muted")}>
              {user.viewAsEmployee ? "Viendo como empleado" : user.roleLabel}
            </p>
          </div>
          {user.isAdmin && (
            <span className="group relative inline-flex">
              <button
                type="button"
                onClick={toggleView}
                disabled={pending}
                aria-label={user.viewAsEmployee ? "Volver a administrador" : "Ver como empleado"}
                aria-pressed={user.viewAsEmployee}
                className={cn(
                  "press grid size-8 place-items-center rounded-md border text-muted hover-fine:hover:text-fg",
                  user.viewAsEmployee && "border-info-line bg-info-soft text-info",
                )}
              >
                <Eye className="size-4" strokeWidth={1.8} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 scale-[0.97] rounded-md border bg-surface px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-[opacity,transform] delay-0 duration-150 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-500"
              >
                {user.viewAsEmployee ? "Volver a administrador" : "Ver como empleado"} <span className="font-mono text-faint">⇧ E</span>
              </span>
            </span>
          )}
          <form action={logout}>
            <button type="submit" aria-label="Salir" title="Salir" className="press grid size-8 place-items-center rounded-md text-fg hover-fine:hover:bg-hover">
              <LogOut className="size-4" strokeWidth={1.8} />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

/** RNF-03: en el celular, el menú se vuelve una barra de pestañas abajo. */
export function MobileTabs({ user, studioName, system }: { user: NavUser; studioName: string; system: SystemStatus | null }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const showAdmin = user.isAdmin && !user.viewAsEmployee;
  const extra = showAdmin ? ADMIN : STAFF_EXTRA;
  const inMore = extra.some((it) => isActive(pathname, it.href));

  useEffect(() => {
    // Al navegar se cierra el menú Más.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMore(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/85 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2 backdrop-blur md:hidden">
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-md border">
            <BrandMark size={18} />
          </span>
          <span className="font-medium">{studioName}</span>
        </span>
        <span className="grid size-[34px] place-items-center rounded-full border bg-line text-[11px] font-semibold">{initials(user.name)}</span>
      </header>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-side pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {MAIN.map((it) => {
          const Icon = it.icon;
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} className={cn("flex h-[60px] flex-1 flex-col items-center gap-[3px] pt-2 text-[11px]", active ? "text-fg" : "text-faint")}>
              <Icon className="size-[22px]" strokeWidth={1.7} />
              {it.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className={cn("flex h-[60px] flex-1 flex-col items-center gap-[3px] pt-2 text-[11px]", more || inMore ? "text-fg" : "text-faint")}
        >
          {more ? <X className="size-[22px]" strokeWidth={1.7} /> : <Ellipsis className="size-[22px]" strokeWidth={1.7} />}
          Más
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}>
          <div className="overlay absolute inset-0 bg-scrim backdrop-blur-[2px]" data-state="open" />
          <div
            className="sheet-up absolute inset-x-2 bottom-[calc(68px+env(safe-area-inset-bottom))] flex flex-col gap-1 rounded-xl border bg-surface p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {extra.map((it) => (
              <NavLink key={it.href} item={it} active={isActive(pathname, it.href)} />
            ))}
            {showAdmin && system && (
              <div className="mt-1">
                <SystemCard status={system} />
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t px-1 pt-2">
              <ThemeToggle />
              <form action={logout}>
                <button type="submit" className="press flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted">
                  <LogOut className="size-4" /> Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
