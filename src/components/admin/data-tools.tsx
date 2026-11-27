"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { applyImport, backupNow, exportToSheets, previewImport, type ImportPreview } from "@/actions/data";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GooglePickerButton } from "./google-picker";

export function ExportTools({ driveReady }: { driveReady: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<{ link: string | null; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const qs = new URLSearchParams({ ...(from ? { desde: from } : {}), ...(to ? { hasta: to } : {}) });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-4">
        <Field label="Desde" htmlFor="from" optional>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        </Field>
        <Field label="Hasta" htmlFor="to" optional>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Sin fechas exporta todo. Clientes y trabajos se filtran por fecha de registro; pagos, por fecha de pago.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!driveReady || pending}
          onClick={() =>
            startTransition(async () => {
              const res = await exportToSheets({ from, to });
              if (!res.ok) return setError(res.error);
              setError(null);
              setResult(res.data!);
            })
          }
        >
          <FileSpreadsheet /> {pending ? "Exportando…" : "Exportar a Google Sheets"}
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/export${qs.size ? `?${qs}` : ""}`}>
            <Download /> Descargar .xlsx
          </a>
        </Button>
      </div>
      {result && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Listo: {result.link ? <a href={result.link} target="_blank" rel="noreferrer" className="underline underline-offset-4">{result.name}</a> : result.name}, en la carpeta del negocio.
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}

type Source = { kind: "drive"; id: string; name: string } | { kind: "file"; file: File };

function toForm(mode: "planilla" | "contingencia", src: Source) {
  const fd = new FormData();
  fd.set("mode", mode);
  if (src.kind === "drive") {
    fd.set("driveFileId", src.id);
    fd.set("fileName", src.name);
  } else fd.set("file", src.file);
  return fd;
}

/** RF-28 y RF-34: vista previa con errores antes de guardar. */
export function ImportTool({ mode, driveReady }: { mode: "planilla" | "contingencia"; driveReady: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = (src: Source) => {
    setSource(src);
    setPreview(null);
    setDone(null);
    startTransition(async () => {
      const res = await previewImport(toForm(mode, src));
      if (!res.ok) return setError(res.error);
      setError(null);
      setPreview(res.data!);
    });
  };

  const apply = () =>
    source &&
    startTransition(async () => {
      const res = await applyImport(toForm(mode, source));
      if (!res.ok) return setError(res.error);
      const c = res.data!.created;
      setDone(
        `Importado: ${c.clients} clientes, ${c.jobs} trabajos${mode === "contingencia" ? `, ${c.statuses} cambios de estado y ${c.payments} pagos` : ""}.` +
          (res.data!.folderErrors.length ? ` No se pudo crear la carpeta de ${res.data!.folderErrors.join(", ")}: créala desde su ficha.` : ""),
      );
      setPreview(null);
      setSource(null);
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {driveReady && (
          <GooglePickerButton
            kind="spreadsheet"
            variant="outline"
            label={mode === "contingencia" ? "Elegir la copia de la planilla" : "Elegir un Google Sheets"}
            title={mode === "contingencia" ? "Elige la copia de la planilla de contingencia" : "Elige la planilla a importar"}
            onPicked={(doc) => load({ kind: "drive", id: doc.id, name: doc.name })}
          />
        )}
        {mode === "planilla" && (
          <>
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              <Upload /> Subir .xlsx
            </Button>
            <input
              ref={input}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) load({ kind: "file", file: f });
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      {pending && !preview && <p className="text-sm text-muted-foreground">Leyendo la planilla…</p>}
      <FormError message={error} />
      {done && <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{done}</p>}
      {preview && (
        <div className="grid gap-3 animate-in fade-in">
          <p className="text-sm">
            <span className="font-medium">{preview.fileName}</span> · {preview.valid} filas listas
            {preview.errors > 0 && <span className="text-danger"> · {preview.errors} con errores (se omiten)</span>}
          </p>
          {preview.alreadyImported && <FormError message="Este archivo ya fue importado. Para no duplicar nada, no se puede importar otra vez." />}
          <div className="max-h-96 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left font-mono text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Hoja</th>
                  <th className="px-3 py-2 font-normal">Fila</th>
                  <th className="px-3 py-2 font-normal">Registro</th>
                  <th className="px-3 py-2 font-normal">Qué pasará</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((i, k) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i.sheet}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.line}</td>
                    <td className="max-w-48 truncate px-3 py-2">{i.label}</td>
                    <td className={i.error ? "px-3 py-2 text-danger" : "px-3 py-2 text-muted-foreground"}>{i.error ?? i.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={pending || !preview.valid || preview.alreadyImported} onClick={apply}>
              {pending ? "Importando…" : `Importar ${preview.valid} filas`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => (setPreview(null), setSource(null))}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BackupNowButton({ disabled }: { disabled: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await backupNow();
            if (!res.ok) return setError(res.error);
            setError(null);
            setMsg("Respaldo creado y planilla de contingencia actualizada.");
          })
        }
      >
        {pending ? "Respaldando…" : "Hacer un respaldo ahora"}
      </Button>
      {msg && <p className="text-sm text-success">{msg}</p>}
      <FormError message={error} />
    </div>
  );
}
