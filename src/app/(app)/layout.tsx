import { requireUser } from "@/lib/auth-guard";
import { getSettings, getSystemStatus } from "@/lib/settings";
import { rolesLabel } from "@/lib/domain";
import { MobileTabs, Sidebar, type NavUser } from "@/components/layout/app-nav";
import { DemoBanner, ViewAsBanner } from "@/components/layout/banners";
import { Toaster } from "@/components/ui/toaster";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const settings = await getSettings();
  const system = user.isAdmin ? await getSystemStatus() : null;
  const navUser: NavUser = {
    name: user.demo ? "Visitante" : user.name,
    roleLabel: user.demo ? "Demo · administrador" : rolesLabel(user.roles),
    isAdmin: user.isAdmin,
    viewAsEmployee: user.viewAsEmployee,
    demo: user.demo,
  };

  return (
    <>
      {user.demo && <DemoBanner />}
      <div className="flex min-h-dvh">
        <Sidebar user={navUser} studioName={settings.studioName} system={system} />
        <main className="sheet-grid flex min-w-0 flex-1 flex-col">
          <MobileTabs user={navUser} studioName={settings.studioName} system={system} />
          {user.viewAsEmployee && (
            <div className="px-4 pt-4 md:px-9 md:pt-6">
              <ViewAsBanner />
            </div>
          )}
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}
