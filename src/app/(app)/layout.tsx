import Link from "next/link";
import { LogOut, TriangleAlert } from "lucide-react";
import { Mark } from "@/components/brand/mark";
import { STUDIO_NAME } from "@/lib/studio";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth-guard";
import { driveState, getSettings } from "@/lib/drive";
import { ROLE_LABELS } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/layout/nav-links";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const drive = isAdmin ? driveState(await getSettings()) : null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <ServiceWorkerRegister />
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/90 px-3 py-2 backdrop-blur md:h-dvh md:flex-col md:items-stretch md:overflow-y-auto md:border-r md:border-b-0 md:p-4">
        <Link href="/" className="flex shrink-0 items-center gap-3 md:mb-6 md:border-b md:pb-5">
          <div className="grid size-9 place-items-center rounded-md border bg-background">
            <Mark />
          </div>
          <div className="leading-tight max-md:hidden">
            <p className="font-medium">{STUDIO_NAME}</p>
            <p className="font-mono text-[11px] text-muted-foreground">Gestión de pedidos</p>
          </div>
        </Link>
        <NavLinks isAdmin={isAdmin} />
        <div className="ml-auto flex shrink-0 items-center gap-2 md:mt-auto md:ml-0 md:flex-col md:items-stretch md:border-t md:pt-4">
          <ThemeToggle className="max-md:hidden md:self-start" />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 max-md:hidden">
              <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="icon" aria-label="Cerrar sesión">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 md:px-8 md:py-10">
        {drive === "desconectado" && (
          // RF-30
          <Link
            href="/admin/configuracion"
            className="mb-6 flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger transition-colors hover:bg-danger/15"
          >
            <TriangleAlert className="size-4 shrink-0" />
            <span>
              <strong className="font-medium">Drive desconectado, vuelve a conectarlo.</strong> Mientras tanto no se crean carpetas ni se suben archivos.
            </span>
          </Link>
        )}
        {children}
        <div className="mt-10 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground md:hidden">
          Tema
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}
