"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { toBlob } from "html-to-image";
import * as D from "@radix-ui/react-dialog";
import type { Urgency } from "@/db/schema";
import { formatPhone } from "@/lib/domain";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { BrandMark } from "@/components/layout/brand";

export type SummaryData = {
  code: string;
  date: string;
  clientName: string;
  clientPhone?: string | null;
  course: string | null;
  cycle: number | null;
  dueAt: string;
  urgency: Urgency;
  deadlineLabel: string;
  lines: { name: string; quantity: number; unit: string | null; amount: number }[];
  subtotal: number;
  surcharge: number;
  extra: number;
  total: number;
  paid: number;
  studio?: { name: string; whatsapp: string | null; facebook: string | null; instagram: string | null; logoUrl?: string | null };
  isQuote?: boolean;
};

const fDate = (d: string) => new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
const fDue = (d: string) => {
  const s = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)).replace(".", "").replace(",", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const unitWord = (unit: string | null, n: number) => {
  if (!unit) return `${n}`;
  const w = unit.replace(/^por\s+/, "");
  const plural = n === 1 ? w : w.endsWith("n") ? `${w.slice(0, -1)}nes`.replace("ónes", "ones").replace("iones", "iones") : w.endsWith("l") || w.endsWith("r") ? `${w}es` : `${w}s`;
  return `${n} ${plural.replace("imagenes", "imágenes").replace("niveles", "niveles")}`;
};
const handle = (v: string | null | undefined) => (v ? v.replace(/^https?:\/\/(www\.)?[^/]+\//, "").replace(/\/$/, "") : null);

/**
 * Resumen para el cliente (RF-62): hoja tipo papel con la marca del estudio.
 * No muestra quién lo hace, quién atendió, horas ni códigos del tarifario.
 */
export function ClientSummaryDialog({ data, onClose }: { data: SummaryData | null; onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState({ detail: true, surcharge: true, advance: true, howToPay: true });
  const [format, setFormat] = useState<"imagen" | "pdf">("imagen");
  const [busy, setBusy] = useState<string | null>(null);

  const render = async () => {
    if (!sheet.current) throw new Error("sin hoja");
    const blob = await toBlob(sheet.current, { pixelRatio: 2, backgroundColor: "#f6f5f0" });
    if (!blob) throw new Error("no se pudo crear la imagen");
    return blob;
  };
  const fileName = data ? `${data.isQuote ? "Cotizacion" : "Resumen"} ${data.code} - ${data.clientName}` : "Resumen";

  const copy = async () => {
    setBusy("copy");
    try {
      const blob = await render();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Imagen copiada. Pégala en el chat.");
      return true;
    } catch {
      toast.error("Tu navegador no deja copiar imágenes. Usa Descargar.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      if (format === "pdf") {
        printSheet(sheet.current!, fileName);
      } else {
        const blob = await render();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileName}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch {
      toast.error("No se pudo descargar.");
    } finally {
      setBusy(null);
    }
  };

  const whatsapp = async () => {
    const ok = await copy();
    if (!data?.clientPhone) return toast.message("El cliente no tiene WhatsApp registrado.");
    if (ok) window.open(`https://wa.me/51${data.clientPhone}`, "_blank", "noopener");
  };

  const pending = data ? Math.max(0, data.total - data.paid) : 0;
  const half = data ? Math.round(data.total * 50) / 100 : 0;

  return (
    <D.Root open={!!data} onOpenChange={(v) => !v && onClose()}>
      <D.Portal>
        <D.Overlay className="overlay fixed inset-0 z-[60] bg-scrim backdrop-blur-[2px]" />
        <D.Content className="modal fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[980px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-surface md:flex-row">
          <div className="scroll-thin flex min-h-0 flex-1 justify-center overflow-y-auto bg-[#2a2a2a] p-6 md:p-8">
            {data && (
              <div ref={sheet} className="w-[420px] max-w-full shrink-0 bg-[#f6f5f0] px-8 py-8 text-[#1a1a1a]" style={{ fontFamily: "var(--font-work-sans)" }}>
                <div className="flex items-center gap-2.5 border-b border-[#d9d7cf] pb-4">
                  {data.studio?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logo pequeño guardado como data URL
                    <img src={data.studio.logoUrl} alt="" className="size-9 rounded-md object-contain" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-md border border-[#1a1a1a]">
                      <BrandMark size={20} />
                    </span>
                  )}
                  <span className="leading-tight">
                    <span className="block text-[17px] font-semibold tracking-tight">{data.studio?.name ?? "Estudio"}</span>
                    <span className="block text-[11px] text-[#6b6a65]">estudio de arquitectura</span>
                  </span>
                  <span className="ml-auto text-right font-mono text-[10.5px] leading-snug text-[#6b6a65]">
                    {data.isQuote ? "COTIZACIÓN" : "RESUMEN"}
                    <span className="block text-[13px] text-[#1a1a1a]">{data.code}</span>
                    {fDate(data.date)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 border-b border-[#d9d7cf] py-4 text-[13px]">
                  <div>
                    <p className="font-mono text-[10px] tracking-wide text-[#6b6a65]">PARA</p>
                    <p className="mt-0.5 font-medium">{data.clientName}</p>
                    <p className="text-[11.5px] text-[#6b6a65]">{[data.course, data.cycle ? `ciclo ${data.cycle}` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-wide text-[#6b6a65]">ENTREGA</p>
                    <p className="mt-0.5 font-medium">{fDue(data.dueAt)}</p>
                    <p className="text-[11.5px] text-[#6b6a65]">entrega en {data.deadlineLabel}</p>
                  </div>
                </div>
                {show.detail && (
                  <div className="border-b border-[#d9d7cf] py-3">
                    <p className="mb-1.5 font-mono text-[10px] tracking-wide text-[#6b6a65]">LO QUE INCLUYE</p>
                    {data.lines.map((l, i) => (
                      <div key={i} className="flex items-baseline gap-2 py-[3px] text-[13px]">
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="text-[11.5px] text-[#6b6a65]">{unitWord(l.unit, l.quantity)}</span>
                        <span className="w-16 text-right font-mono text-[12.5px]">{l.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1 py-3 text-[13px]">
                  {show.surcharge && data.surcharge > 0 && (
                    <>
                      <Row label="Subtotal" value={formatMoney(data.subtotal)} />
                      <Row label={`Entrega en ${data.deadlineLabel}`} value={formatMoney(data.surcharge)} />
                    </>
                  )}
                  {data.extra > 0 && <Row label="Adicional por complejidad" value={formatMoney(data.extra)} />}
                  <div className="mt-1 flex items-baseline justify-between border-t border-[#1a1a1a] pt-2">
                    <span className="text-[15px] font-semibold">Total</span>
                    <span className="font-mono text-[19px] font-semibold">{formatMoney(data.total)}</span>
                  </div>
                </div>
                {show.advance && (
                  <div className="flex flex-col gap-1 rounded-md bg-[#ecebe5] px-3 py-2.5 text-[13px]">
                    {data.paid > 0 ? (
                      <>
                        <Row label="Ya pagó" value={formatMoney(data.paid)} />
                        <Row label="Pendiente contra entrega" value={formatMoney(pending)} strong />
                      </>
                    ) : (
                      <>
                        <Row label="Adelanto 50 % para empezar" value={formatMoney(half)} strong />
                        <Row label="Pendiente contra entrega" value={formatMoney(data.total - half)} />
                      </>
                    )}
                  </div>
                )}
                <p className="mt-3 text-[11.5px] leading-relaxed text-[#6b6a65]">
                  Incluye 2 rondas de corrección.
                  {show.howToPay && data.studio?.whatsapp && ` Yape / Plin al ${formatPhone(data.studio.whatsapp)}.`}
                </p>
                {data.studio && (
                  <div className="mt-4 flex justify-between border-t border-[#d9d7cf] pt-3 font-mono text-[10.5px] text-[#6b6a65]">
                    {data.studio.whatsapp && <span>WhatsApp {formatPhone(data.studio.whatsapp)}</span>}
                    <span>{[handle(data.studio.facebook) && `fb ${handle(data.studio.facebook)}`, handle(data.studio.instagram) && `ig @${handle(data.studio.instagram)}`].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex w-full shrink-0 flex-col gap-5 border-t p-5 md:w-[320px] md:border-t-0 md:border-l">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 font-mono text-[11px] text-muted">02 · Trabajos · resumen</p>
                <D.Title className="text-lg font-medium">Resumen para el cliente</D.Title>
                <D.Description className="mt-1 text-[12.5px] text-muted">Sale de lo que ya llenaste. No muestra quién lo hace, quién atendió, horas ni códigos del tarifario.</D.Description>
              </div>
              <D.Close aria-label="Cerrar" className="press grid size-8 shrink-0 place-items-center rounded-md text-muted hover-fine:hover:bg-hover">
                <X className="size-4" />
              </D.Close>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[11px] text-muted">Mostrar</p>
              {(
                [
                  ["detail", "Detalle de cada ítem"],
                  ["surcharge", "Recargo por urgencia aparte"],
                  ["advance", "Adelanto y pendiente"],
                  ["howToPay", "Cómo pagar (Yape / Plin)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px]">
                  <input type="checkbox" checked={show[k]} onChange={(e) => setShow((s) => ({ ...s, [k]: e.target.checked }))} className="peer sr-only" />
                  <span className={cn("grid size-[18px] place-items-center rounded-[5px] border transition-colors duration-150", show[k] ? "border-fg bg-primary" : "border-border-strong")}>
                    {show[k] && <Check className="size-3 text-on-primary" strokeWidth={3} />}
                  </span>
                  {label}
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[11px] text-muted">Formato</p>
              <Choice
                label="Formato"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "imagen", label: "Imagen" },
                  { value: "pdf", label: "PDF" },
                ]}
                size="sm"
              />
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <Button variant="primary" onClick={whatsapp} disabled={!!busy}>
                <MessageCircle /> Enviar por WhatsApp
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="md" onClick={copy} disabled={!!busy}>
                  <Copy /> Copiar imagen
                </Button>
                <Button size="md" onClick={download} disabled={!!busy}>
                  <Download /> Descargar
                </Button>
              </div>
              <p className="text-xs text-faint">WhatsApp abre el chat con la imagen copiada; tú la pegas y das enviar.</p>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[#6b6a65]">{label}</span>
      <span className={cn("font-mono", strong && "font-semibold")}>{value}</span>
    </div>
  );
}

/** PDF: se imprime solo la hoja en una ventana aparte («Guardar como PDF»). */
function printSheet(node: HTMLElement, title: string) {
  const w = window.open("", "_blank", "width=600,height=800");
  if (!w) return;
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join("");
  w.document.write(`<!doctype html><html><head><title>${title}</title>${styles}<style>body{margin:0;background:#f6f5f0}@page{margin:12mm}</style></head><body>${node.outerHTML}</body></html>`);
  w.document.close();
  w.onload = () => {
    w.focus();
    w.print();
  };
}
