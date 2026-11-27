"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, ExternalLink, HardDrive, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { disconnectDrive, setDriveRoot } from "@/actions/drive";
import { backupNow } from "@/actions/data";
import { saveAlerts, saveStudio, setBackupEnabled } from "@/actions/settings";
import type { DriveState } from "@/lib/drive";
import { initials } from "@/lib/domain";
import { dayKey, timeLima, todayLima } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { openPicker } from "@/components/admin/google-picker";

export type ConfigTab = "drive" | "estudio" | "respaldo" | "avisos";
type Drive = {
  state: DriveState;
  account: string | null;
  rootName: string | null;
  rootUrl: string | null;
  backupsUrl: string | null;
  contingencyUrl: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  quota: { used: number; limit: number | null } | null;
  shared: { id: string; name: string; email: string; shared: boolean }[] | null;
};
type Studio = { studioName: string; whatsapp: string; contactEmail: string; academicTerm: string; instagram: string; tiktok: string; facebook: string; logoUrl: string };
type Backup = { enabled: boolean; lastAt: string | null; lastOk: boolean | null; lastCode: string | null };
type Alerts = { quoteDays: number; pendingDays: number; driveFullGb: number; quoteOn: boolean; pendingOn: boolean; driveOn: boolean; backupFailed: boolean };

const TABS: { v: ConfigTab; label: string }[] = [
  { v: "drive", label: "Google Drive" },
  { v: "estudio", label: "Estudio" },
  { v: "respaldo", label: "Respaldo" },
  { v: "avisos", label: "Avisos" },
];
const FLASH: Record<string, [string, "ok" | "error"]> = {
  conectado: ["Drive conectado. Ahora elige la carpeta raíz.", "ok"],
  cancelado: ["Cancelaste el permiso de Google.", "error"],
  "sin-permiso": ["Google no dio el permiso de Drive. Vuelve a intentarlo y marca la casilla de Drive.", "error"],
  "sin-llave": ["Google no entregó la llave. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.", "error"],
  "sin-google": ["Falta configurar el inicio de sesión con Google (AUTH_GOOGLE_ID).", "error"],
  error: ["No se pudo conectar Drive. Inténtalo de nuevo.", "error"],
};
const gb = (b: number) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(b / 1024 ** 3);
const dmy = (iso: string) => {
  const d = dayKey(iso);
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("enter flex flex-col rounded-lg border bg-surface px-[22px] py-5", className)}>{children}</section>;
}
function Head({ title, sub, aside }: { title: string; sub: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-[13px] !leading-[1.45] text-muted">{sub}</p>
      </div>
      {aside}
    </div>
  );
}
function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line py-2.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className={cn("text-right", mono && "font-mono text-[13px]")}>{v}</span>
    </div>
  );
}
function Row({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3.5">
      <div>
        <p className="text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">{children}</div>
    </div>
  );
}
function OutlineBtn({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cn("press inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3.5 text-sm font-medium whitespace-nowrap disabled:opacity-45", className)} />;
}
function StatusPill({ tone, children }: { tone: "success" | "danger" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border px-2 text-xs whitespace-nowrap",
        tone === "success" && "border-success-line text-success",
        tone === "danger" && "border-danger-line text-danger",
        tone === "muted" && "text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Configuración, igual al Design final: submenú Drive · Estudio · Respaldo · Avisos (RF-56). */
export function ConfigBoard({ tab, flash, meEmail, drive, studio, backup, alerts }: { tab: ConfigTab; flash: string | null; meEmail: string; drive: Drive; studio: Studio; backup: Backup; alerts: Alerts }) {
  const msg = flash ? FLASH[flash] : null;
  return (
    <div className="flex flex-col gap-[18px] [&_*]:leading-[normal]">
      <header>
        <p className="font-mono text-[11px] text-muted">12 · Configuración</p>
        <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Configuración</h1>
        <p className="text-sm text-muted">Ajustes del estudio. Solo el administrador entra aquí.</p>
      </header>
      <div className="flex flex-col gap-7 md:flex-row">
        <nav className="flex shrink-0 gap-0.5 overflow-x-auto md:w-[200px] md:flex-col">
          {TABS.map((t) => (
            <Link
              key={t.v}
              href={`/configuracion?tab=${t.v}`}
              scroll={false}
              className={cn("row flex items-center justify-between rounded-md px-3 py-[9px] text-sm whitespace-nowrap", tab === t.v ? "bg-line text-fg" : "text-muted")}
            >
              {t.label}
              {t.v === "drive" && drive.state === "desconectado" && <span className="size-1.5 rounded-full bg-danger" />}
            </Link>
          ))}
        </nav>
        <div key={tab} className="flex min-w-0 flex-1 flex-col gap-4 md:max-w-[880px]">
          {msg && <p className={cn("enter rounded-md border px-4 py-2.5 text-[13px]", msg[1] === "ok" ? "border-success-line text-success" : "border-danger-line text-danger")}>{msg[0]}</p>}
          {tab === "drive" && <DriveTab drive={drive} meEmail={meEmail} />}
          {tab === "estudio" && <StudioTab init={studio} />}
          {tab === "respaldo" && <BackupTab backup={backup} drive={drive} />}
          {tab === "avisos" && <AlertsTab init={alerts} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Google Drive ---------- */

function DriveTab({ drive, meEmail }: { drive: Drive; meEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const chooseFolder = () =>
    start(async () => {
      try {
        const doc = await openPicker("folder", "Elige la carpeta raíz del estudio");
        if (!doc) return;
        const r = await setDriveRoot(doc.id);
        if (!r.ok) return void toast.error(r.error);
        toast.success(`Carpeta raíz: ${doc.name}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo abrir el selector de Google.");
      }
    });
  const icon = (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg border">
      <HardDrive className="size-[18px] text-muted" />
    </span>
  );

  if (drive.state === "sin_conectar") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="text-sm font-medium">Google Drive</h3>
              <p className="mt-1 text-[13px] text-muted">Los archivos y respaldos van a la carpeta raíz, nunca a otro lugar del Drive.</p>
            </div>
          </div>
          <StatusPill tone="muted">Sin conectar</StatusPill>
        </div>
        <ol className="mt-4 flex flex-col">
          {[
            ["Dar el permiso en Google", `Con la cuenta del estudio${meEmail ? `, por ejemplo ${meEmail}` : ""}. Solo pide acceso a lo que la app crea o eliges.`],
            ["Elegir la carpeta raíz", "Ahí se crean las carpetas de cada trabajo y la de Respaldos."],
            ["Listo", "Se comparte sola con quienes tienen acceso en Usuarios."],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-center gap-3.5 border-t border-line py-3">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full border border-[#4a4a4a] font-mono text-[11px] text-muted">{i + 1}</span>
              <div>
                <p className="text-sm">{t}</p>
                <p className="mt-0.5 text-xs text-faint">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="pt-3.5">
          <a href="/api/drive/connect" className="press inline-flex h-10 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-on-primary">
            Conectar Drive
          </a>
        </div>
      </Card>
    );
  }

  const off = drive.state === "desconectado";
  const used = drive.quota ? drive.quota.used : null;
  const limit = drive.quota?.limit ?? null;
  return (
    <>
      {off && (
        <section className="enter flex items-center justify-between gap-4 rounded-lg border border-danger-line bg-danger-soft px-[22px] py-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div>
              <p className="text-sm font-medium">Drive desconectado, vuelve a conectarlo</p>
              <p className="mt-1 text-[13px] text-muted">
                Desde {drive.disconnectedAt ? `${dayKey(drive.disconnectedAt) === todayLima() ? "hoy" : dmy(drive.disconnectedAt)} ${timeLima(drive.disconnectedAt)}` : "hace un momento"} no se pueden subir archivos ni hacer el respaldo. Puede pasar si cambiaste la contraseña de Google o quitaste el permiso.
              </p>
            </div>
          </div>
          <a href="/api/drive/connect" className="press inline-flex h-10 shrink-0 items-center rounded-md border border-primary bg-primary px-4 text-sm font-medium text-on-primary">
            Volver a conectar
          </a>
        </section>
      )}
      <Card className="gap-1.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="text-sm font-medium">Google Drive</h3>
              <p className="mt-1 text-[13px] text-muted">Los archivos y respaldos van a la carpeta raíz, nunca a otro lugar del Drive.</p>
            </div>
          </div>
          {off ? <StatusPill tone="danger">Desconectado</StatusPill> : drive.state === "sin_carpeta" ? <StatusPill tone="muted">Falta la carpeta</StatusPill> : <StatusPill tone="success">● Conectado</StatusPill>}
        </div>
        <KV k="Cuenta" v={drive.account ?? "—"} />
        <KV k="Carpeta raíz" v={drive.rootName ? `Mi unidad › ${drive.rootName}` : <span className="text-faint">Sin elegir</span>} />
        {drive.connectedAt && !off && <KV k="Conectado desde" v={dmy(drive.connectedAt)} mono />}
        {used != null && !off && (
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-muted">Espacio usado</span>
              <span className="font-mono text-xs">
                {gb(used)} {limit ? `de ${gb(limit)} GB` : "GB"}
              </span>
            </div>
            {limit && (
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="grow-x h-full rounded-full bg-fg" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-3.5">
          {drive.rootUrl && !off && (
            <a href={drive.rootUrl} target="_blank" rel="noreferrer" className="press inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3.5 text-sm font-medium">
              <ExternalLink className="size-4" /> Abrir en Drive
            </a>
          )}
          {!off && (
            <OutlineBtn disabled={pending} onClick={chooseFolder} className={drive.state === "sin_carpeta" ? "border-primary bg-primary text-on-primary" : undefined}>
              {drive.state === "sin_carpeta" ? "Elegir la carpeta raíz" : "Cambiar carpeta"}
            </OutlineBtn>
          )}
          <a href="/api/drive/connect" className="press inline-flex h-10 items-center rounded-md border bg-surface px-3.5 text-sm font-medium">
            {off ? "Volver a conectar" : "Cambiar cuenta"}
          </a>
          {!off && (
            <OutlineBtn
              disabled={pending}
              className="ml-auto text-muted"
              onClick={() =>
                start(async () => {
                  const r = await disconnectDrive();
                  if (!r.ok) toast.error(r.error);
                  else router.refresh();
                })
              }
            >
              Desconectar
            </OutlineBtn>
          )}
        </div>
      </Card>
      {drive.shared && (
        <Card>
          <Head title="Compartida con" sub="Al dar acceso en Usuarios se comparte sola; al quitarlo, se deja de compartir." aside={<span className="font-mono text-[11px] text-muted">{drive.shared.length} personas</span>} />
          {drive.shared.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
              <div className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border bg-line text-[9px] font-semibold">{initials(p.name)}</span>
                <div>
                  <p className="text-sm">{p.name}</p>
                  <p className="font-mono text-[11px] text-faint">{p.email}</p>
                </div>
              </div>
              <span className={cn("text-xs", p.shared ? "text-muted" : "text-warning")}>{p.shared ? "Puede editar" : "Aún no compartida"}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ---------- Estudio ---------- */

function StudioTab({ init }: { init: Studio }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(init);
  const set = (k: keyof Studio) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const dirty = JSON.stringify(v) !== JSON.stringify(init);
  const input = "h-10 w-full rounded-md border bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-muted";
  const field = (k: keyof Studio, label: string, ph?: string, hint?: string, mono?: boolean) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <input value={v[k]} onChange={set(k)} placeholder={ph} className={cn(input, mono && "font-mono")} />
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
  const onLogo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 150 * 1024) return void toast.error("El logo pesa más de 150 KB.");
    const r = new FileReader();
    r.onload = () => setV((x) => ({ ...x, logoUrl: String(r.result) }));
    r.readAsDataURL(f);
  };
  const save = () =>
    start(async () => {
      const r = await saveStudio(v);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Datos del estudio guardados.");
      router.refresh();
    });
  return (
    <>
      <Card>
        <Head title="Datos del estudio" sub="Se usan en los mensajes, el resumen para el cliente y la planilla de contingencia." />
        <div className="grid gap-x-4 gap-y-3.5 pt-2 md:grid-cols-2">
          {field("studioName", "Nombre")}
          {field("whatsapp", "WhatsApp", "987 654 321", undefined, true)}
          {field("contactEmail", "Correo de contacto", "estudio@gmail.com")}
          {field("academicTerm", "Ciclo académico actual", "2026-II", "Se propone al registrar un trabajo. Cámbialo al empezar cada ciclo; vacío se deduce de la fecha.", true)}
        </div>
        <div className="mt-4 flex items-center gap-3.5 border-t border-line pt-4">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL pequeño */}
            {v.logoUrl ? <img src={v.logoUrl} alt="Logo del estudio" className="size-full object-contain" /> : <ImageUp className="size-5 text-faint" />}
          </span>
          <div className="flex-1">
            <p className="text-sm">Logo</p>
            <p className="mt-0.5 text-xs text-faint">PNG, JPG o SVG de hasta 150 KB. Sale en el resumen para el cliente.</p>
          </div>
          <label className="press inline-flex h-9 cursor-pointer items-center rounded-md border bg-surface px-3 text-[13px] font-medium">
            {v.logoUrl ? "Cambiar" : "Subir"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
          </label>
          {v.logoUrl && (
            <button aria-label="Quitar el logo" onClick={() => setV((x) => ({ ...x, logoUrl: "" }))} className="press grid size-9 place-items-center rounded-md border text-muted">
              <X className="size-4" />
            </button>
          )}
        </div>
      </Card>
      <Card>
        <Head title="Redes del estudio" sub="Solo se muestran las que estén llenas (RF-55)." />
        <div className="grid gap-x-4 gap-y-3.5 pt-2 md:grid-cols-3">
          {field("instagram", "Instagram", "instagram.com/estudio")}
          {field("tiktok", "TikTok", "tiktok.com/@estudio")}
          {field("facebook", "Facebook", "facebook.com/estudio")}
        </div>
      </Card>
      <Card>
        <Head title="Región" sub="Fijo para todo el sistema." />
        <KV k="Moneda" v={`Soles · ${new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(1250)}`} />
        <KV k="Hora" v="Lima, Perú (UTC−5)" />
        <KV k="Formato de fecha" v={dmy(new Date().toISOString())} mono />
      </Card>
      <div className="flex gap-2">
        <button disabled={pending || !dirty} onClick={save} className="press h-10 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-45">
          Guardar
        </button>
        <OutlineBtn disabled={pending || !dirty} onClick={() => setV(init)}>
          Cancelar
        </OutlineBtn>
      </div>
    </>
  );
}

/* ---------- Respaldo ---------- */

function BackupTab({ backup, drive }: { backup: Backup; drive: Drive }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const connected = drive.state === "conectado";
  const last = backup.lastAt ? `${dayKey(backup.lastAt) === todayLima() ? "Hoy" : dmy(backup.lastAt)} ${timeLima(backup.lastAt)}` : null;
  return (
    <>
      <Card>
        <Head title="Respaldo diario" sub="Copia de clientes, trabajos y pagos como Google Sheets en Drive › Respaldos." />
        <Row title="Hacer respaldo cada noche" sub="Se guardan los últimos 30 días; los más antiguos se borran solos.">
          <Switch
            size="md"
            on={backup.enabled}
            disabled={pending}
            label="Hacer respaldo cada noche"
            onChange={(on) =>
              start(async () => {
                const r = await setBackupEnabled(on);
                if (!r.ok) toast.error(r.error);
                router.refresh();
              })
            }
          />
        </Row>
        <Row title="Hora" sub="De madrugada, cuando nadie usa el sistema. La fija el servidor.">
          <span className="inline-flex h-10 items-center rounded-md border bg-bg px-3 font-mono text-sm">03:00</span>
        </Row>
        <Row
          title="Último respaldo"
          sub={
            last ? (
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", backup.lastOk === false ? "bg-danger" : "bg-success")} />
                {last} · {backup.lastOk === false ? "falló" : "sin errores"}
              </span>
            ) : (
              "Todavía no se hizo ninguno"
            )
          }
        >
          <button
            disabled={pending || !connected}
            title={connected ? undefined : "Conecta Drive primero"}
            onClick={() =>
              start(async () => {
                const r = await backupNow();
                if (!r.ok) return void toast.error(r.error);
                toast.success("Respaldo guardado en Drive.");
                router.refresh();
              })
            }
            className="press h-9 rounded-md border bg-surface px-3 text-[13px] font-medium disabled:opacity-45"
          >
            Hacer uno ahora
          </button>
        </Row>
        <Row title="Carpeta" sub={drive.rootName ? `Mi unidad › ${drive.rootName} › Respaldos` : "Se crea al conectar Drive"}>
          {drive.backupsUrl && (
            <a href={drive.backupsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover-fine:hover:text-fg">
              Abrir <ExternalLink className="size-3" />
            </a>
          )}
        </Row>
      </Card>
      <Card>
        <Head title="Planilla de contingencia" sub="La que se usa si el sistema se cae. Se actualiza sola cada noche con el último código de cada servicio." />
        <Row title="Estado" sub={drive.contingencyUrl ? `Al día · último código ${backup.lastCode ?? "—"}` : "Se crea con el primer respaldo"}>
          {drive.contingencyUrl && (
            <a href={drive.contingencyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover-fine:hover:text-fg">
              Abrir <ExternalLink className="size-3" />
            </a>
          )}
        </Row>
        <Row title="Cuando el sistema vuelva" sub="Importa la copia que usaron desde Datos.">
          <Link href="/datos" className="text-[13px] text-muted hover-fine:hover:text-fg">
            Ir a Datos →
          </Link>
        </Row>
      </Card>
    </>
  );
}

/* ---------- Avisos ---------- */

function AlertsTab({ init }: { init: Alerts }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(init);
  const dirty = JSON.stringify(v) !== JSON.stringify(init);
  const num = (k: "quoteDays" | "pendingDays" | "driveFullGb", unit: string) => (
    <>
      <input
        type="number"
        min={1}
        value={v[k]}
        onChange={(e) => setV((x) => ({ ...x, [k]: Number(e.target.value) }))}
        aria-label={unit}
        className="h-9 w-24 rounded-md border bg-bg px-3 font-mono text-sm outline-none focus:border-muted"
      />
      <span className="w-6 text-[13px] text-muted">{unit}</span>
    </>
  );
  const sw = (k: "quoteOn" | "pendingOn" | "driveOn" | "backupFailed", label: string) => <Switch size="md" on={v[k]} label={label} onChange={(on) => setV((x) => ({ ...x, [k]: on }))} />;
  return (
    <>
      <Card>
        <Head title="Cuándo avisar" sub="Los avisos salen en el Inicio. Nadie recibe correos ni mensajes." />
        <Row title="Cotización sin respuesta" sub="Pasa a «Cotizaciones sin respuesta» después de">
          {num("quoteDays", "días")}
          {sw("quoteOn", "Avisar cotizaciones sin respuesta")}
        </Row>
        <Row title="Pendiente por cobrar" sub="Se marca en ámbar si sigue sin pagarse después de entregar por">
          {num("pendingDays", "días")}
          {sw("pendingOn", "Avisar pendientes por cobrar")}
        </Row>
        <Row title="Espacio en Drive" sub="Aviso en la tarjeta Sistema al llegar a">
          {num("driveFullGb", "GB")}
          {sw("driveOn", "Avisar espacio en Drive")}
        </Row>
        <Row title="Respaldo que falló" sub="Punto ámbar en la tarjeta Sistema si el respaldo de la noche no se hizo">
          {sw("backupFailed", "Avisar respaldo fallido")}
        </Row>
      </Card>
      <div className="flex gap-2">
        <button
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const r = await saveAlerts(v);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Avisos guardados.");
              router.refresh();
            })
          }
          className="press h-10 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-45"
        >
          Guardar
        </button>
        <OutlineBtn disabled={pending || !dirty} onClick={() => setV(init)}>
          Cancelar
        </OutlineBtn>
      </div>
    </>
  );
}
