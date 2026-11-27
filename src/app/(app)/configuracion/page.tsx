import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { driveState, folderUrl, listRootPermissions, storageQuota, tryDrive } from "@/lib/drive";
import { getSettings } from "@/lib/settings";
import { yearLima } from "@/lib/dates";
import { PageBody } from "@/components/layout/page-header";
import { ConfigBoard, type ConfigTab } from "@/components/admin/config-board";

export const metadata = { title: "Configuración" };

const TABS: ConfigTab[] = ["drive", "estudio", "respaldo", "avisos"];

/** RF-22, RF-26, RF-30, RF-32, RF-33, RF-55 y RF-56 (solo admin). */
export default async function ConfigPage({ searchParams }: PageProps<"/configuracion">) {
  const me = await requireUser("admin");
  const sp = await searchParams;
  const tab = (TABS.includes(sp.tab as ConfigTab) ? sp.tab : "drive") as ConfigTab;
  const s = await getSettings();
  const state = driveState(s);
  const [quota, perms, people, last] = await Promise.all([
    tab === "drive" ? tryDrive(storageQuota) : null,
    tab === "drive" ? tryDrive(listRootPermissions) : null,
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.active, true)),
    db.query.jobs.findFirst({ where: eq(jobs.year, yearLima()), orderBy: desc(jobs.seq), columns: { code: true } }),
  ]);
  return (
    <PageBody>
      <ConfigBoard
        tab={tab}
        flash={typeof sp.drive === "string" ? sp.drive : null}
        meEmail={me.email}
        drive={{
          state,
          account: s.driveAccountEmail,
          rootName: s.driveRootFolderName,
          rootUrl: s.driveRootFolderId ? folderUrl(s.driveRootFolderId) : null,
          backupsUrl: s.driveBackupsFolderId ? folderUrl(s.driveBackupsFolderId) : null,
          contingencyUrl: s.driveContingencyFileId ? `https://docs.google.com/spreadsheets/d/${s.driveContingencyFileId}` : null,
          connectedAt: s.driveConnectedAt?.toISOString() ?? null,
          disconnectedAt: s.driveDisconnectedAt?.toISOString() ?? null,
          quota,
          shared: perms
            ? people
                .filter((p) => p.email !== s.driveAccountEmail)
                .map((p) => ({ ...p, shared: perms.some((x) => x.emailAddress?.toLowerCase() === p.email.toLowerCase()) }))
            : null,
        }}
        studio={{ studioName: s.studioName, whatsapp: s.whatsapp ?? "", contactEmail: s.contactEmail ?? "", academicTerm: s.academicTerm ?? "", instagram: s.instagram ?? "", tiktok: s.tiktok ?? "", facebook: s.facebook ?? "", logoUrl: s.logoUrl ?? "" }}
        backup={{ enabled: s.backupEnabled, lastAt: s.lastBackupAt?.toISOString() ?? null, lastOk: s.lastBackupOk, lastCode: last?.code ?? null }}
        alerts={{
          quoteDays: s.alerts.quoteDays,
          pendingDays: s.alerts.pendingDays,
          driveFullGb: s.alerts.driveFullGb ?? 12,
          quoteOn: s.alerts.quoteOn ?? true,
          pendingOn: s.alerts.pendingOn ?? true,
          driveOn: s.alerts.driveOn ?? true,
          backupFailed: s.alerts.backupFailed,
        }}
      />
    </PageBody>
  );
}
