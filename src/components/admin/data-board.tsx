"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, Download, ExternalLink, FileSpreadsheet, Sheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { applyImport, backupNow, countForExport, exportToSheets, previewImport, type ImportPreview } from "@/actions/data";
import type { DriveState } from "@/lib/drive";
import { monthStart } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { DialogRoot, DialogContent } from "@/components/ui/dialog";
import { openPicker } from "@/components/admin/google-picker";

export type Backup = { id: string; name: string; day: string | null; link: string; createdAt: string | null };
type Counts = { clientes: number; trabajos: number; pagos: number };
type Preset = "mes" | "ano" | "todo";
type Source = { mode: "planilla" | "contingencia"; file?: File; driveFileId?: string; fileName?: string };

const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const hm = (iso: string | null) => (iso ? new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" }).format(new Date(iso)) : "—");

function Btn({ primary, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...p}
      className={cn(
        "press inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-medium whitespace-nowrap disabled:opacity-45",
        primary ? "border-primary bg-primary px-4 text-on-primary" : "bg-surface",
        className,
      )}
    />
  );
}

/** Datos, igual al Design final. */
export function DataBoard({ today, counts: initial, drive, backups, contingencyId, lastBackupOk }: { today: string; counts: Counts; drive: DriveState; backups: Backup[] | null; contingencyId: string | null; lastBackupOk: boolean | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tables, setTables] = useState({ clientes: true, trabajos: true, pagos: true });
  const [preset, setPreset] = useState<Preset | null>("mes");
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [counts, setCounts] = useState(initial);
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const connected = drive === "conectado";
  const needDrive = connected ? undefined : "Conecta Drive en Configuración";

  const recount = (f: string, t: string) =>
    start(async () => {
      const r = await countForExport({ from: f, to: t });
      if (r.ok && r.data) setCounts(r.data);
    });
  const applyPreset = (p: Preset) => {
    const f = p === "mes" ? monthStart(today) : p === "ano" ? `${today.slice(0, 4)}-01-01` : "";
    setPreset(p);
    setFrom(f);
    setTo(p === "todo" ? "" : today);
    recount(f, p === "todo" ? "" : today);
  };
  const query = new URLSearchParams({ tablas: Object.entries(tables).filter(([, v]) => v).map(([k]) => k).join(","), ...(from ? { desde: from } : {}), ...(to ? { hasta: to } : {}) });

  const formOf = (src: Source) => {
    const fd = new FormData();
    fd.set("mode", src.mode);
    if (src.file) fd.set("file", src.file);
    if (src.driveFileId) {
      fd.set("driveFileId", src.driveFileId);
      fd.set("fileName", src.fileName ?? "");
    }
    return fd;
  };
  const runPreview = (src: Source) =>
    start(async () => {
      setSource(src);
      const r = await previewImport(formOf(src));
      if (!r.ok) return void toast.error(r.error);
      setPreview(r.data!);
    });
  const pick = (mode: Source["mode"]) =>
    start(async () => {
      try {
        const doc = await openPicker("spreadsheet", mode === "planilla" ? "Elige la hoja para importar" : "Elige la copia de la planilla de contingencia");
        if (doc) runPreview({ mode, driveFileId: doc.id, fileName: doc.name });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo abrir el selector de Google.");
      }
    });
  const confirm = () =>
    start(async () => {
      const r = await applyImport(formOf(source!));
      if (!r.ok) return void toast.error(r.error);
      const d = r.data!;
      toast.success(`Importado: ${d.clientes} clientes, ${d.trabajos} trabajos y ${d.pagos} pagos.`);
      setPreview(null);
      router.refresh();
    });

  const shownBackups = backups?.slice(0, 7) ?? [];
  const latest = backups?.[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] [&_*]:leading-[normal]">
      <header>
        <p className="font-mono text-[11px] text-muted">09 · Datos</p>
        <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Datos</h1>
        <p className="text-sm text-muted">Exportar, importar y respaldos.</p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <section className="enter flex flex-col gap-4 rounded-lg border bg-surface p-[18px]">
          <div>
            <h3 className="text-sm font-medium">Exportar</h3>
            <p className="mt-1 text-[13px] !leading-[1.45] text-muted">Saca clientes, trabajos y pagos para un reporte o para tenerlos fuera del sistema.</p>
          </div>
          <div className="flex flex-wrap gap-[18px]">
            {(["clientes", "trabajos", "pagos"] as const).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2.5 text-sm capitalize">
                <input type="checkbox" className="sr-only" checked={tables[k]} onChange={() => setTables((t) => ({ ...t, [k]: !t[k] }))} />
                <span className={cn("grid size-4 place-items-center rounded-[4px] border transition-colors", tables[k] ? "border-fg bg-fg text-bg" : "border-[#4a4a4a]")}>{tables[k] && <Check className="size-3" strokeWidth={3.5} />}</span>
                {k}
                <span className="font-mono text-[11px] text-faint">{counts[k]}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            {(
              [
                ["Desde", from, setFrom],
                ["Hasta", to, setTo],
              ] as const
            ).map(([l, v, set]) => (
              <label key={l} className="flex w-[150px] flex-col gap-1.5">
                <span className="text-[13px] text-muted">{l}</span>
                <input
                  type="date"
                  value={v}
                  max={today}
                  onChange={(e) => {
                    set(e.target.value);
                    setPreset(null);
                    recount(l === "Desde" ? e.target.value : from, l === "Hasta" ? e.target.value : to);
                  }}
                  className="h-10 rounded-md border bg-bg px-3 font-mono text-sm outline-none focus:border-muted dark:[color-scheme:dark]"
                />
              </label>
            ))}
            <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-[7px] border bg-surface p-[3px]">
              {(
                [
                  ["mes", "Mes"],
                  ["ano", "Año"],
                  ["todo", "Todo"],
                ] as [Preset, string][]
              ).map(([v, l]) => (
                <button key={v} role="radio" aria-checked={preset === v} onClick={() => applyPreset(v)} className={cn("press h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors", preset === v ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <Btn
              primary
              disabled={pending || !connected}
              title={needDrive}
              onClick={() =>
                start(async () => {
                  const r = await exportToSheets({ from, to, ...tables });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`Guardado en Drive: ${r.data!.name}`, r.data!.link ? { action: { label: "Abrir", onClick: () => window.open(r.data!.link!, "_blank") } } : undefined);
                })
              }
            >
              <Sheet className="size-4" /> Guardar en Drive como Sheets
            </Btn>
            <a href={`/api/export?${query}`} className={cn("press inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3.5 text-sm font-medium", !Object.values(tables).some(Boolean) && "pointer-events-none opacity-45")}>
              <Download className="size-4" /> Descargar .xlsx
            </a>
          </div>
        </section>

        <section className="enter flex flex-col gap-4 rounded-lg border bg-surface p-[18px]" style={{ "--i": 1 } as React.CSSProperties}>
          <div>
            <h3 className="text-sm font-medium">Importar</h3>
            <p className="mt-1 text-[13px] !leading-[1.45] text-muted">Carga clientes y trabajos que hoy están fuera del sistema. Usa la plantilla para que las columnas coincidan.</p>
          </div>
          <ol className="flex flex-col gap-2">
            {["Descarga la plantilla y llénala", "Elige la hoja en tu Drive o sube el .xlsx", "Revisa la vista previa y los errores", "Confirma"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full border border-[#4a4a4a] font-mono text-[11px] text-muted">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-auto flex flex-wrap gap-2">
            <a href="/api/plantilla" className="press inline-flex h-10 items-center gap-2 rounded-md border bg-surface px-3.5 text-sm font-medium">
              <Download className="size-4" /> Plantilla
            </a>
            <Btn primary disabled={pending || !connected} title={needDrive} onClick={() => pick("planilla")}>
              <FileSpreadsheet className="size-4" /> Elegir hoja de Drive
            </Btn>
            <Btn disabled={pending} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Subir .xlsx
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) runPreview({ mode: "planilla", file: f });
              }}
            />
          </div>
        </section>

        <section className="enter grid min-h-0 overflow-hidden rounded-lg border bg-surface lg:col-span-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="flex min-h-0 flex-col border-line lg:border-r">
            <div className="flex items-end justify-between gap-3 px-[18px] pt-4 pb-3">
              <div>
                <h3 className="text-sm font-medium">Respaldos diarios</h3>
                <p className="mt-1 text-[13px] !leading-[1.45] text-muted">Cada noche a las 03:00 se guarda una copia en Drive › Respaldos. Se guardan 30 días.</p>
              </div>
              {backups && <span className="font-mono text-[11px] whitespace-nowrap text-muted">{backups.length} de 30</span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!connected && (
                <div className="mx-[18px] mb-4 rounded-md border border-dashed px-4 py-8 text-center text-[13px] text-muted">
                  Los respaldos empiezan cuando conectes Drive.{" "}
                  <Link href="/configuracion" className="text-fg underline underline-offset-2">
                    Ir a Configuración
                  </Link>
                </div>
              )}
              {connected && backups?.length === 0 && (
                <div className="mx-[18px] mb-4 rounded-md border border-dashed px-4 py-8 text-center text-[13px] text-muted">
                  Todavía no hay respaldos. El primero se hace esta noche, o ahora:{" "}
                  <button disabled={pending} onClick={() => start(async () => { const r = await backupNow(); if (!r.ok) toast.error(r.error); else { toast.success("Respaldo guardado en Drive."); router.refresh(); } })} className="text-fg underline underline-offset-2">
                    hacer un respaldo
                  </button>
                </div>
              )}
              {connected && backups === null && <p className="mx-[18px] mb-4 rounded-md border border-danger-line px-4 py-3 text-[13px] text-danger">No se pudo leer la carpeta Respaldos en Drive.</p>}
              {shownBackups.map((b, i) => (
                <div key={b.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-3.5 border-t border-line px-[18px] py-[11px] text-sm">
                  <Sheet className="size-4 text-muted" />
                  <span className="flex items-center gap-2">
                    Respaldo {dmy(b.day!)}
                    {i === 0 && b.day === today && <span className="inline-flex h-[22px] items-center rounded-full border border-success-line px-2 text-xs text-success">Hoy</span>}
                  </span>
                  <span className="font-mono text-xs text-muted">{hm(b.createdAt)}</span>
                  <a href={b.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover-fine:hover:text-fg">
                    Abrir <ExternalLink className="size-3" />
                  </a>
                </div>
              ))}
              {backups && backups.length > 7 && (
                <a href={backups[0].link.replace(/\/spreadsheets\/d\/.*/, "/drive/my-drive")} target="_blank" rel="noreferrer" className="block border-t border-line px-[18px] py-3 text-[13px] text-muted hover-fine:hover:text-fg">
                  Ver los {backups.length} en Drive →
                </a>
              )}
              {lastBackupOk === false && <p className="mx-[18px] my-3 text-[13px] text-danger">El último respaldo falló. Revisa la conexión con Drive.</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line p-[18px] lg:border-t-0">
            <div>
              <h3 className="text-sm font-medium">Si el sistema se cae</h3>
              <p className="mt-1 text-[13px] !leading-[1.45] text-muted">La planilla de contingencia está lista en Respaldos. Cuando el sistema vuelva, impórtala aquí.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-bg/40 px-3.5 py-3">
              <div>
                <p className="text-[13px] font-medium">Planilla de contingencia</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">{contingencyId ? `actualizada con el respaldo${latest?.day ? ` del ${dmy(latest.day)}` : ""}` : "se crea con el primer respaldo"}</p>
              </div>
              {contingencyId && (
                <a href={`https://docs.google.com/spreadsheets/d/${contingencyId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover-fine:hover:text-fg">
                  Abrir <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <div className="mt-auto">
              <Btn disabled={pending || !connected} title={needDrive} onClick={() => pick("contingencia")}>
                <Upload className="size-4" /> Importar planilla de contingencia
              </Btn>
            </div>
          </div>
        </section>
      </div>

      <DialogRoot open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        {preview && (
          <DialogContent
            title={`Vista previa · ${preview.fileName}`}
            description={preview.alreadyImported ? "Este archivo ya fue importado: no se puede volver a cargar." : `${preview.valid} filas listas${preview.errors ? ` · ${preview.errors} con error (no se importan)` : ""}.`}
            className="max-w-[720px]"
            footer={
              <>
                <button onClick={() => setPreview(null)} className="press h-9 rounded-md border bg-surface px-3.5 text-sm font-medium">
                  Volver
                </button>
                <button disabled={pending || preview.alreadyImported || !preview.valid} onClick={confirm} className="press h-9 rounded-md border border-primary bg-primary px-3.5 text-sm font-medium text-on-primary disabled:opacity-45">
                  Importar {preview.valid} {preview.valid === 1 ? "fila" : "filas"}
                </button>
              </>
            }
          >
            <div className="flex max-h-[52vh] flex-col overflow-y-auto">
              {preview.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-3 border-t border-line py-2 text-[13px] first:border-t-0">
                  <span className="font-mono text-[11px] text-faint">
                    {it.sheet} · {it.line}
                  </span>
                  <span className="truncate">{it.label}</span>
                  <span className={it.error ? "text-danger" : "text-muted"}>{it.error ?? it.action}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        )}
      </DialogRoot>
    </div>
  );
}
