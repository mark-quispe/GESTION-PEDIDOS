import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { driveState, folderUrl, getSettings } from "@/lib/drive";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { BackupNowButton, ExportTools, ImportTool } from "@/components/admin/data-tools";

export const metadata: Metadata = { title: "Datos" };

function Block({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

export default async function DataPage() {
  await requireUser("admin");
  const s = await getSettings();
  const ready = driveState(s) === "conectado";
  return (
    <>
      <PageHeader index="Administración" title="Datos" description="Exportar, importar, respaldos y contingencia." />
      {!ready && (
        <p className="mb-6 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Para Google Sheets, respaldos y contingencia hay que{" "}
          <Link href="/admin/configuracion" className="underline underline-offset-4">
            conectar Drive y elegir la carpeta
          </Link>
          . La descarga y la subida de .xlsx funcionan igual.
        </p>
      )}
      <div className="grid max-w-4xl gap-6">
        <Block title="Exportar" description="Clientes, trabajos y pagos, completos o por fechas. Para reportes o para sacar los datos si algún día se deja de usar el sistema.">
          <ExportTools driveReady={ready} />
        </Block>
        <Block
          title="Importar clientes y trabajos"
          description={
            <>
              Para la carga inicial de datos que hoy están fuera del sistema. Usa la{" "}
              <a href="/api/plantilla" className="underline underline-offset-4">
                plantilla
              </a>{" "}
              (las mismas columnas que el respaldo). Antes de guardar verás una vista previa con los errores.
            </>
          }
        >
          <ImportTool mode="planilla" driveReady={ready} />
        </Block>
        <Block
          title="Respaldos"
          description={
            <>
              Cada día se guarda un Google Sheets en la carpeta “Respaldos”, con una hoja por tabla. Se conservan los últimos 30 días.
              {s.lastBackupAt ? ` Último: ${formatDateTime(s.lastBackupAt)}.` : ""}
              {s.driveBackupsFolderId && (
                <>
                  {" "}
                  <a href={folderUrl(s.driveBackupsFolderId)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    Abrir la carpeta
                  </a>
                </>
              )}
            </>
          }
        >
          <BackupNowButton disabled={!ready} />
        </Block>
        <Block
          title="Volver de una contingencia"
          description="Cuando el sistema vuelve: elige la copia de la planilla de contingencia que usaron durante la caída. Se aplican en orden clientes, trabajos, cambios de estado y pagos; se respetan los códigos escritos y se crean las carpetas en Drive. Un archivo ya importado se rechaza."
        >
          {ready ? <ImportTool mode="contingencia" driveReady /> : <p className="text-sm text-muted-foreground">Requiere Drive conectado.</p>}
        </Block>
      </div>
    </>
  );
}
