"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  Settings,
  Shapes,
  Trash2,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/trabajos", label: "Trabajos", icon: ClipboardList },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/carga", label: "Carga", icon: CalendarRange },
];

const ADMIN = [
  { href: "/pagos", label: "Pagos", icon: Wallet },
  { href: "/admin/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/admin/responsables", label: "Responsables", icon: Wrench },
  { href: "/admin/servicios", label: "Servicios", icon: Shapes },
  { href: "/admin/datos", label: "Datos", icon: Database },
  { href: "/admin/eliminados", label: "Eliminados", icon: Trash2 },
  { href: "/admin/historial", label: "Historial", icon: History },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

type Item = (typeof MAIN)[number] & { exact?: boolean };

function NavItem({ item, pathname, compact }: { item: Item; pathname: string; compact?: boolean }) {
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:min-h-9",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className={cn(compact && !active && "max-md:sr-only")}>{item.label}</span>
    </Link>
  );
}

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const adminActive = ADMIN.some((i) => pathname.startsWith(i.href)) || pathname === "/admin";
  return (
    <nav aria-label="Principal" className="flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {MAIN.map((item) => (
        <NavItem key={item.href} item={item} pathname={pathname} compact />
      ))}
      {isAdmin && (
        <>
          {/* Móvil: un solo acceso al menú de administración. */}
          <Link
            href="/admin"
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground md:hidden",
              adminActive && "bg-accent text-foreground",
            )}
          >
            <Settings className="size-4" />
            <span className={cn(!adminActive && "sr-only")}>Admin</span>
          </Link>
          <p className="mt-6 mb-1 px-3 font-mono text-[11px] text-muted-foreground max-md:hidden">Administración</p>
          <div className="flex flex-col gap-1 max-md:hidden">
            {ADMIN.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

export const ADMIN_SECTIONS = ADMIN;
