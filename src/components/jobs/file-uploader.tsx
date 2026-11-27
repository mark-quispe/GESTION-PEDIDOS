"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import type { JobFolder } from "@/db/schema";
import { registerUpload, startUpload } from "@/actions/files";
import { FOLDER_LABELS, UPLOAD_FOLDERS } from "@/lib/domain";
import { uploadToDrive } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";

/** Sube un archivo a Drive y lo registra. Lo usan los archivos (RF-24) y las capturas de pago (RF-43). */
export async function uploadJobFile(opts: { jobId: string; folder: JobFolder; file: File; paymentId?: string; onProgress?: (f: number) => void }) {
  const session = await startUpload({ jobId: opts.jobId, folder: opts.folder, name: opts.file.name, size: opts.file.size, mimeType: opts.file.type || "application/octet-stream" });
  if (!session.ok) throw new Error(session.error);
  const uploaded = await uploadToDrive(session.data!.uploadUrl, opts.file, opts.onProgress);
  const res = await registerUpload({ jobId: opts.jobId, folder: opts.folder, driveFileId: uploaded.id, paymentId: opts.paymentId });
  if (!res.ok) throw new Error(res.error);
}

export function FileUploader({ jobId }: { jobId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<JobFolder>("recibido");
  const [queue, setQueue] = useState<{ name: string; size: number; progress: number; error?: string }[]>([]);
  const [pending, startTransition] = useTransition();

  const upload = (files: FileList) => {
    const list = [...files];
    setQueue(list.map((f) => ({ name: f.name, size: f.size, progress: 0 })));
    startTransition(async () => {
      for (const [i, file] of list.entries()) {
        try {
          await uploadJobFile({
            jobId,
            folder,
            file,
            onProgress: (p) => setQueue((q) => q.map((item, j) => (j === i ? { ...item, progress: p } : item))),
          });
        } catch (e) {
          setQueue((q) => q.map((item, j) => (j === i ? { ...item, error: e instanceof Error ? e.message : "Error" } : item)));
        }
      }
      setQueue((q) => q.filter((item) => item.error));
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <NativeSelect aria-label="Subcarpeta" className="w-auto" value={folder} onChange={(e) => setFolder(e.target.value as JobFolder)} disabled={pending}>
          {UPLOAD_FOLDERS.map((f) => (
            <option key={f} value={f}>
              {FOLDER_LABELS[f]}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          <Upload /> {pending ? "Subiendo…" : "Subir archivos"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {queue.length > 0 && (
        <ul className="grid gap-2">
          {queue.map((q, i) => (
            <li key={i} className="grid gap-1 text-sm">
              <span className="flex justify-between gap-2">
                <span className="truncate">{q.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{q.error ? "" : `${Math.round(q.progress * 100)} % de ${formatBytes(q.size)}`}</span>
              </span>
              {q.error ? (
                <span className="text-xs text-danger">{q.error}</span>
              ) : (
                <span className="h-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full origin-left rounded-full bg-foreground transition-transform duration-200 ease-(--ease-out)" style={{ transform: `scaleX(${q.progress})` }} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
