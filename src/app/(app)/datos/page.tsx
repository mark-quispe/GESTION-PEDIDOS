import { requireUser } from "@/lib/auth-guard";
import { countExport, listBackups } from "@/lib/data-io";
import { driveState } from "@/lib/drive";
import { getSettings } from "@/lib/settings";
import { monthStart, todayLima } from "@/lib/dates";
import { PageBody } from "@/components/layout/page-header";
import { DataBoard, type Backup } from "@/components/admin/data-board";

export const metadata = { title: "Datos" };

/** RF-27, RF-28, RF-32 a RF-34: exportar, importar y respaldos (solo admin). */
export default async function DataPage() {
  await requireUser("admin");
  const today = todayLima();
  const s = await getSettings();
  const drive = driveState(s);
  const [counts, backups] = await Promise.all([
    countExport({ from: monthStart(today), to: today }),
    drive === "conectado" ? listBackups().catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <PageBody className="lg:h-dvh lg:max-h-dvh lg:min-h-[860px] lg:overflow-hidden">
      <DataBoard
        today={today}
        counts={counts}
        drive={drive}
        backups={backups as Backup[] | null}
        contingencyId={s.driveContingencyFileId}
        lastBackupOk={s.lastBackupOk}
      />
    </PageBody>
  );
}
