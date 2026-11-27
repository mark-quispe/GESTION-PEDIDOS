import type { Metadata } from "next";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { driveState, folderUrl, getSettings } from "@/lib/drive";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CodeStartForm } from "@/components/admin/catalog-forms";
import { ChooseRootFolder, DisconnectDrive } from "@/components/admin/drive-settings";

export const metadata: Metadata = { title: "Configuración" };

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  conectado: { tone: "ok", text: "Drive conectado. Ahora elige la carpeta del negocio (si no lo has hecho)." },
  cancelado: { tone: "error", text: "Cancelaste el permiso de Google. Drive sigue sin conectar." },
  "sin-permiso": { tone: "error", text: "Google no dio el permiso de archivos. Vuelve a conectar y marca la casilla de Drive." },
  "sin-llave": { tone: "error", text: "Google no entregó la llave de acceso. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar." },
  error: { tone: "error", text: "No se pudo conectar Drive. Inténtalo otra vez." },
};

export default async function SettingsPage({ searchParams }: PageProps<"/admin/configuracion">) {
  await requireUser("admin");
  const { drive: flash } = await searchParams;
  const s = await getSettings();
  const state = driveState(s);
  const msg = typeof flash === "string" ? MESSAGES[flash] : undefined;

  return (
    <>
      <PageHeader index="Administración" title="Configuración" />
      <div className="grid max-w-3xl gap-6">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-medium">Google Drive</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Los archivos se guardan en tu Drive, dentro de la carpeta que elijas. La app solo ve lo que ella misma crea ahí, no el resto de tu Drive. El empleado no necesita acceso.
          </p>
          {msg && (
            <p className={msg.tone === "ok" ? "mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success" : "mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"}>{msg.text}</p>
          )}
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="flex items-center gap-2">
              {state === "conectado" ? <CircleCheck className="size-4 text-success" /> : <TriangleAlert className={state === "desconectado" ? "size-4 text-danger" : "size-4 text-warning"} />}
              {{ sin_conectar: "Sin conectar", sin_carpeta: "Conectado, falta elegir la carpeta", conectado: "Conectado", desconectado: "Drive desconectado, vuelve a conectarlo" }[state]}
            </dd>
            {s.driveAccountEmail && (
              <>
                <dt className="text-muted-foreground">Cuenta</dt>
                <dd>{s.driveAccountEmail}</dd>
              </>
            )}
            {s.driveRootFolderId && (
              <>
                <dt className="text-muted-foreground">Carpeta raíz</dt>
                <dd>
                  <a href={folderUrl(s.driveRootFolderId)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    {s.driveRootFolderName ?? s.driveRootFolderId}
                  </a>
                </dd>
              </>
            )}
            {s.lastBackupAt && (
              <>
                <dt className="text-muted-foreground">Último respaldo</dt>
                <dd>{formatDateTime(s.lastBackupAt)}</dd>
              </>
            )}
          </dl>
          <div className="mt-6 flex flex-wrap items-start gap-3 border-t pt-5">
            <Button asChild variant={state === "sin_conectar" || state === "desconectado" ? "default" : "outline"}>
              {/* Ruta de servidor: navegación completa a la pantalla de permiso de Google. */}
              <a href="/api/drive/connect">{state === "sin_conectar" ? "Conectar Drive" : state === "desconectado" ? "Volver a conectar" : "Cambiar de cuenta"}</a>
            </Button>
            {(state === "sin_carpeta" || state === "conectado") && <ChooseRootFolder hasRoot={!!s.driveRootFolderId} />}
            {state !== "sin_conectar" && <DisconnectDrive />}
          </div>
          {state === "conectado" && (
            <p className="mt-4 text-xs text-muted-foreground">
              Si cambias la carpeta o la cuenta, los archivos nuevos van al destino nuevo. Los anteriores se quedan donde estaban y sus enlaces siguen funcionando; moverlos se hace a mano en Drive.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="font-medium">Correlativo de los códigos</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Número con el que empieza cada año. Puedes empezar en 100 para no revelar el volumen del negocio. Si ya hay trabajos este año, solo se nota cuando el número nuevo es mayor que el último usado.
          </p>
          <CodeStartForm value={s.codeStart} />
        </section>
      </div>
    </>
  );
}
