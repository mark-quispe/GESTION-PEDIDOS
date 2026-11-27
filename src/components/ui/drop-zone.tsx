"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Recuadro «Pega o arrastra» para la captura del comprobante (RF-43).
 * Acepta pegar con Ctrl+V mientras la ventana está abierta, arrastrar o elegir.
 */
export function DropZone({
  file,
  onFile,
  title = "Pega o arrastra la imagen del Yape",
  where,
  disabledHint,
  accept = "image/*",
  className,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  title?: string;
  where?: string;
  disabledHint?: string | null;
  accept?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const disabled = !!disabledHint;

  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
      if (f) onFile(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, onFile]);

  if (file)
    return (
      <div className={cn("flex items-center gap-3 rounded-md border bg-bg px-3 py-2.5", className)}>
        <ImageUp className="size-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-[13px]">{file.name}</span>
        <button type="button" aria-label="Quitar" onClick={() => onFile(null)} className="press grid size-7 place-items-center rounded text-muted hover-fine:hover:text-fg">
          <X className="size-3.5" />
        </button>
      </div>
    );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border border-dashed px-3 py-3 text-left transition-colors duration-150 disabled:cursor-default disabled:opacity-60",
        over ? "border-fg bg-hover" : "border-border-strong hover-fine:hover:border-muted",
        className,
      )}
    >
      <ImageUp className="size-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{title}</span>
        <span className="block font-mono text-[11px] text-faint">{disabledHint ?? where}</span>
      </span>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </button>
  );
}
