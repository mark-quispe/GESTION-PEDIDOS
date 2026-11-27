"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Clock, Lock, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createServiceItem, setCycleFactor, setItemPrice, setUrgency } from "@/actions/services";
import type { Urgency } from "@/db/schema";
import type { CustomRequest, ServiceCategory, ServiceRow, ServicesData } from "@/lib/queries/services";
import { jobCode, normalizeText, URGENCY_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { FixedBox, StepBox } from "@/components/ui/step-box";
import { DialogRoot, SheetContent } from "@/components/ui/dialog";

const COLS = "grid-cols-[64px_minmax(0,1fr)_92px_60px_64px_118px]";
const CYCLES: { label: string; key: number }[] = [3, 4, 5, 6, 7, 8].map((c) => ({ label: `ciclo ${c}`, key: c })).concat([{ label: "ciclo 9–10", key: 9 }]);
const money = (n: number) => new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(n);
const money2 = (n: number) => new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const hrs = (h: number | null) => (h == null ? "—" : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(h)}`);

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (ok) toast.success(ok);
      router.refresh();
    });
  return { pending, save };
}

/** Servicios = tarifario (RF-08, RF-57, RF-68), igual al Design final. Empleado y Producción lo ven en solo lectura. */
export function ServicesBoard({ data, admin, n }: { data: ServicesData; admin: boolean; n: string }) {
  const { save } = useSave();
  const [catId, setCatId] = useState(data.categories.find((c) => c.code === "PL")?.id ?? data.categories[0]?.id);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<null | { name?: string; price?: number; categoryId?: string }>(null);

  const cat = data.categories.find((c) => c.id === catId) ?? data.categories[0];
  const regular = data.categories.filter((c) => !c.isCustom);
  const total = regular.reduce((a, c) => a + c.items.length, 0);
  const results = useMemo(() => {
    const t = normalizeText(q);
    if (!t) return null;
    return regular.flatMap((c) => c.items.filter((i) => normalizeText(`${i.code} ${i.name} ${i.includes ?? ""}`).includes(t)).map((i) => ({ ...i, cat: c })));
  }, [q, regular]);
  const prefix = cat && !cat.isCustom ? cat.prefix : (regular[0]?.prefix ?? "PL");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] [&_*]:leading-[normal]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] text-muted">{n} · Servicios</p>
          <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Servicios</h1>
          <p className="text-sm text-muted">{admin ? "El tarifario del estudio. Cada trabajo se arma con estos ítems; el prefijo del ítem principal da el código." : "El tarifario del estudio, para cotizar."}</p>
        </div>
        {admin ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-10 items-center gap-2.5 rounded-md border bg-surface px-3 text-[13px] whitespace-nowrap text-muted">
              Siguiente número <span className="font-mono text-sm text-fg">{jobCode(prefix, data.year, data.nextSeq)}</span>
            </span>
            <button onClick={() => setCreating({ categoryId: cat?.isCustom ? regular[0]?.id : cat?.id })} className="press inline-flex h-10 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium whitespace-nowrap text-on-primary">
              <Plus className="size-4" /> Nuevo ítem
            </button>
          </div>
        ) : (
          <span className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[13px] text-muted">
            <Lock className="size-3.5" /> Solo el administrador los cambia
          </span>
        )}
      </header>

      <UrgencyRibbon data={data} admin={admin} save={save} />
      <CycleRibbon data={data} admin={admin} save={save} />

      <div className="flex min-h-[520px] flex-1 flex-col gap-3.5 lg:min-h-0 lg:flex-row">
        <aside className="enter flex shrink-0 flex-col gap-px overflow-y-auto rounded-lg border bg-surface p-2 lg:w-[250px]" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="mx-2.5 mt-1 mb-2 flex justify-between font-mono text-[11px] text-muted">
            <span>Categorías</span>
            <span className="text-faint">{total} ítems</span>
          </p>
          {data.categories.map((c) => {
            const on = c.id === cat?.id && !results;
            return (
              <button
                key={c.id}
                onClick={() => (setCatId(c.id), setQ(""))}
                className={cn("row flex h-[34px] shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left", on ? "bg-line text-fg" : "text-fg-2", c.isCustom && "mt-1.5 shadow-[0_-7px_0_-6px_var(--border)]")}
              >
                <span className={cn("w-8 font-mono text-[11.5px] font-medium", on ? "text-fg" : "text-muted")}>{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                <span className="font-mono text-[11px] text-faint">{c.items.length}</span>
              </button>
            );
          })}
        </aside>

        <section className="enter flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-surface" style={{ "--i": 3 } as React.CSSProperties}>
          {cat?.isCustom && !results ? (
            <CustomPanel cat={cat} customs={data.customs} admin={admin} onAdd={(c) => setCreating({ name: c.text, price: c.price, categoryId: regular[0]?.id })} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                {results ? (
                  <p className="text-[15px] font-medium">
                    Resultados <span className="ml-2 text-[12.5px] font-normal text-faint">{results.length} ítems</span>
                  </p>
                ) : (
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[13px] font-medium">{cat.code}</span>
                    <span className="text-[15px] font-medium">{cat.name}</span>
                    <span className="text-[12.5px] text-faint">
                      {cat.items.length} ítems{cat.items.length > 0 && ` · S/ ${money(Math.min(...cat.items.map((i) => i.basePrice)))}–${money(Math.max(...cat.items.map((i) => i.basePrice)))}`}
                    </span>
                  </div>
                )}
                <label className="flex h-[30px] w-[220px] items-center gap-2 rounded-md border bg-bg px-2.5 text-[13px] focus-within:border-muted">
                  <Search className="size-3.5 text-faint" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar en los ${total} ítems`} aria-label="Buscar ítems" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="min-w-[720px]">
                  <div className={cn("sticky top-0 z-10 grid h-[34px] items-center gap-3 border-b border-line bg-surface px-4 font-mono text-[11px] text-faint", COLS)}>
                    <span>código</span>
                    <span>trabajo</span>
                    <span>se cobra</span>
                    <span>horas</span>
                    <span>ciclo</span>
                    <span className="text-right">precio base</span>
                  </div>
                  {(results ?? cat.items.map((i) => ({ ...i, cat }))).map((i) => (
                    <ItemRow key={i.id} item={i} admin={admin} save={save} />
                  ))}
                  {results?.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-muted">Nada en el tarifario con «{q}». Si se pide, va como Personalizado.</p>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {admin && (
        <DialogRoot open={!!creating} onOpenChange={(v) => !v && setCreating(null)}>
          {creating && <NewItemSheet key={JSON.stringify(creating)} init={creating} categories={regular} factor7={data.cycleFactors["7"] ?? 1.4} onDone={() => setCreating(null)} />}
        </DialogRoot>
      )}
    </div>
  );
}

type Save = ReturnType<typeof useSave>["save"];

function UrgencyRibbon({ data, admin, save }: { data: ServicesData; admin: boolean; save: Save }) {
  const levels: Urgency[] = ["normal", "alta", "urgente"];
  return (
    <section className="enter flex flex-wrap items-center justify-between gap-[18px] rounded-lg border bg-surface px-[18px] py-3">
      <p className="font-mono text-[11px] !leading-[1.6] text-muted">
        Recargo por
        <br />
        urgencia
      </p>
      {levels.map((l, i) => {
        const u = data.urgency[l];
        const days = l === "normal";
        return (
          <div key={l} className={cn("flex items-center gap-2.5", i > 0 && "lg:border-l lg:border-line lg:pl-[18px]")}>
            <span className="text-sm font-medium">{URGENCY_LABEL[l]}</span>
            {admin ? (
              <>
                <StepBox
                  label={`Plazo ${URGENCY_LABEL[l]}`}
                  icon={<Clock className="size-3.5" />}
                  value={days ? Math.round(u.hours / 24) : u.hours}
                  min={1}
                  max={days ? 60 : 240}
                  unit={days ? "días" : "h"}
                  minWidth={days ? 96 : 78}
                  onCommit={(v) => save(() => setUrgency(l, days ? v * 24 : v, u.pct), `${URGENCY_LABEL[l]}: plazo guardado.`)}
                />
                {l === "normal" ? (
                  <FixedBox unit="%">0</FixedBox>
                ) : (
                  <StepBox label={`Recargo ${URGENCY_LABEL[l]}`} value={u.pct} max={500} unit="%" tone="danger" onCommit={(v) => save(() => setUrgency(l, u.hours, v), `${URGENCY_LABEL[l]}: recargo guardado.`)} />
                )}
              </>
            ) : (
              <>
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-muted px-2 font-mono text-xs">
                  <Clock className="size-3.5" /> plazo {days ? `${Math.round(u.hours / 24)} días` : `${u.hours} h`}
                </span>
                <span className={cn("font-mono text-[13px]", u.pct ? "text-danger" : "text-faint")}>{u.pct ? `+${u.pct}%` : "0%"}</span>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

function CycleRibbon({ data, admin, save }: { data: ServicesData; admin: boolean; save: Save }) {
  return (
    <section className="enter flex items-center justify-between gap-3 overflow-x-auto rounded-lg border bg-surface px-[18px] py-3" style={{ "--i": 1 } as React.CSSProperties}>
      <p className="shrink-0 font-mono text-[11px] !leading-[1.6] text-muted">
        Factor por ciclo
        <br />
        <span className="text-faint">solo ítems ×C</span>
      </p>
      <div className="flex shrink-0 flex-col items-start gap-[5px]">
        <span className="font-mono text-[11px] text-muted">ciclo 1–2</span>
        {admin ? (
          <FixedBox height={34} minWidth={72}>
            ×1.00
          </FixedBox>
        ) : (
          <span className="font-mono text-[13.5px]">×1.00</span>
        )}
      </div>
      {CYCLES.map((c) => {
        const f = data.cycleFactors[String(c.key)] ?? 1;
        return (
          <div key={c.key} className="flex shrink-0 flex-col items-start gap-[5px]">
            <span className="font-mono text-[11px] text-muted">{c.label}</span>
            {admin ? (
              <StepBox label={`Factor ${c.label}`} value={f} step={0.05} min={1} max={5} decimals={2} prefix="×" height={34} minWidth={50} arrowWidth={22} onCommit={(v) => save(() => setCycleFactor(c.key, v), `Factor del ${c.label} guardado.`)} />
            ) : (
              <span className="font-mono text-[13.5px]">×{f.toFixed(2)}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}

function CycleChip({ mode }: { mode: "fijo" | "ciclo" }) {
  return mode === "ciclo" ? (
    <span className="inline-flex h-[22px] items-center rounded-[5px] border border-border-strong bg-line px-[7px] font-mono text-[11px] text-fg">×C</span>
  ) : (
    <span className="inline-flex h-[22px] items-center rounded-[5px] border px-[7px] font-mono text-[11px] text-faint">FIJO</span>
  );
}

function ItemRow({ item, admin, save }: { item: ServiceRow & { cat: ServiceCategory }; admin: boolean; save: Save }) {
  return (
    <div className={cn("row grid min-h-[46px] items-center gap-3 border-b border-[#242424] px-4 light:border-line", COLS)}>
      <span className="font-mono text-xs text-muted">{item.code}</span>
      <span className="min-w-0 truncate text-[13.5px]" title={item.includes ? `${item.name} · ${item.includes}` : item.name}>
        {item.name}
        {item.includes && <span className="text-[12.5px] text-faint"> · {item.includes}</span>}
      </span>
      <span className="truncate text-[12.5px] text-muted">{item.unit}</span>
      <span className="font-mono text-xs text-muted">{item.hours == null ? "—" : `${hrs(item.hours)} h`}</span>
      <span>
        <CycleChip mode={item.pricingMode} />
      </span>
      <span className="flex justify-end">
        {admin ? (
          <StepBox label={`Precio base ${item.code}`} value={item.basePrice} step={5} prefix="S/" height={32} minWidth={58} arrowWidth={22} onCommit={(v) => save(() => setItemPrice(item.id, v), `${item.code}: S/ ${money(v)}.`)} />
        ) : (
          <span className="font-mono text-[13.5px]">S/ {money(item.basePrice)}</span>
        )}
      </span>
    </div>
  );
}

function CustomPanel({ cat, customs, admin, onAdd }: { cat: ServiceCategory; customs: CustomRequest[]; admin: boolean; onAdd: (c: CustomRequest) => void }) {
  const it = cat.items[0];
  const steps = [
    ["Se describe", "Al registrar el trabajo se escribe qué pide el cliente con todo el detalle."],
    ["Precio a mano", "Quien registra escribe el precio que acordó con el admin. No lleva factor por ciclo."],
    ["Recargo igual", "La urgencia suma su recargo como en cualquier ítem. Si el trabajo solo tiene personalizados, el código empieza con OT."],
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[13px] font-medium">{cat.code}</span>
          <span className="text-[15px] font-medium">{cat.name}</span>
          <span className="text-[12.5px] text-faint">lo que no está en el tarifario</span>
        </div>
        <span className="font-mono text-[11px] text-faint">siempre al final</span>
      </div>
      <div className="m-4 grid gap-6 rounded-lg border border-dashed p-4 md:grid-cols-3">
        {steps.map(([t, d], i) => (
          <div key={t}>
            <p className="font-mono text-[11px] font-medium">
              {i + 1} · {t}
            </p>
            <p className="mt-2 text-[13px] !leading-[1.5] text-muted">{d}</p>
          </div>
        ))}
      </div>
      <div className={cn("grid h-[34px] items-center gap-3 border-y border-line px-4 font-mono text-[11px] text-faint", COLS)}>
        <span>código</span>
        <span>trabajo</span>
        <span>se cobra</span>
        <span>horas</span>
        <span>ciclo</span>
        <span className="text-right">precio base</span>
      </div>
      {it && (
        <div className={cn("grid min-h-[50px] items-center gap-3 px-4", COLS)}>
          <span className="font-mono text-xs text-muted">{it.code}</span>
          <span className="truncate text-[13.5px]">
            {it.name} <span className="text-[12.5px] text-faint">· se describe en cada trabajo</span>
          </span>
          <span className="text-[12.5px] text-muted">{it.unit}</span>
          <span className="text-xs text-muted">a mano</span>
          <span>
            <CycleChip mode="fijo" />
          </span>
          <span className="flex justify-end">
            <span className="inline-flex h-8 w-[104px] items-center justify-center rounded-md border border-dashed text-[13px] text-muted">a mano</span>
          </span>
        </div>
      )}
      <div className="px-4 pt-4 pb-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">Pedidos personalizados recientes</h3>
          <span className="text-xs text-faint">{admin ? "Si algo se repite, pásalo al tarifario con su precio." : "Para ver cuánto se cobró antes por algo parecido."}</span>
        </div>
        {customs.length === 0 && <p className="border-t border-line py-6 text-center text-[13px] text-muted">Todavía no se registró ningún pedido personalizado.</p>}
        {customs.map((c) => (
          <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-5 border-t border-line py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm">{c.text}</p>
              <p className="mt-0.5 font-mono text-[11px] text-faint">
                {c.jobCode} · {c.clientName}
              </p>
            </div>
            <span className={cn("font-mono text-xs", c.times > 2 ? "text-warning" : "text-muted")}>
              se pidió {c.times} {c.times === 1 ? "vez" : "veces"}
            </span>
            <span className="w-[86px] text-right font-mono text-sm">S/ {money2(c.price)}</span>
            {admin ? (
              <button onClick={() => onAdd(c)} className="press inline-flex h-8 items-center gap-1.5 rounded-md border bg-surface px-3 text-[13px] font-medium">
                <Plus className="size-3.5" /> Agregar al tarifario
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Nuevo ítem ---------- */

const UNITS = ["por plano", "por nivel", "por lámina", "por corte", "por trabajo"];

function NewItemSheet({ init, categories, factor7, onDone }: { init: { name?: string; price?: number; categoryId?: string }; categories: ServiceCategory[]; factor7: number; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [categoryId, setCategoryId] = useState(init.categoryId ?? categories[0]?.id);
  const [name, setName] = useState(init.name ?? "");
  const [includes, setIncludes] = useState("");
  const [unit, setUnit] = useState("por plano");
  const [other, setOther] = useState(false);
  const [price, setPrice] = useState(init.price ?? 50);
  const [hours, setHours] = useState(2.5);
  const [mode, setMode] = useState<"ciclo" | "fijo">(init.price != null ? "fijo" : "ciclo");
  const cat = categories.find((c) => c.id === categoryId);
  const nextCode = cat ? `${cat.code}-${String(cat.items.reduce((m, i) => Math.max(m, Number(i.code.split("-")[1]) || 0), 0) + 1).padStart(2, "0")}` : "—";
  const at7 = mode === "ciclo" ? price * factor7 : price;

  const submit = () =>
    start(async () => {
      const r = await createServiceItem({ categoryId: categoryId!, name, includes, unit, basePrice: price, hours: hours || null, pricingMode: mode });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data?.code} ya está en el tarifario.`);
      router.refresh();
      onDone();
    });

  const lbl = (t: string, hint?: string) => (
    <span className="mb-1.5 flex justify-between text-[13px] text-muted">
      <span>{t}</span>
      {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
    </span>
  );
  const input = "h-10 w-full rounded-md border bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-muted";

  return (
    <SheetContent
      className="max-w-[480px] bg-side [&_*]:leading-[normal]"
      eyebrow="08 · Servicios · nuevo"
      title="Nuevo ítem"
      footer={
        <div className="flex gap-2">
          <button onClick={onDone} className="press h-10 rounded-md border bg-surface px-4 text-sm font-medium">
            Cancelar
          </button>
          <button onClick={submit} disabled={pending || name.trim().length < 3} className="press h-10 rounded-md border border-primary bg-primary px-4 text-sm font-medium text-on-primary disabled:opacity-45">
            Crear ítem
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), submit())} className="flex flex-col gap-[18px] py-1">
        <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-3">
          <label className="block">
            {lbl("Categoría")}
            <span className="relative block">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(input, "appearance-none pr-9")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
            </span>
          </label>
          <div>
            {lbl("Código", "automático")}
            <span className="flex h-10 items-center rounded-md border border-dashed px-3 font-mono text-sm text-muted">{nextCode}</span>
          </div>
        </div>
        <label className="block">
          {lbl("Nombre")}
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Plano de detalles de baño" className={input} />
        </label>
        <label className="block">
          {lbl("Qué incluye", "opcional")}
          <input value={includes} onChange={(e) => setIncludes(e.target.value)} placeholder="Planta, cortes y enchapes a escala 1:25" className={input} />
        </label>
        <div>
          {lbl("Se cobra")}
          <div className="flex flex-wrap gap-1.5">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => (setUnit(u), setOther(false))}
                className={cn("press h-8 rounded-md border px-2.5 text-[13px] transition-colors", unit === u && !other ? "border-fg text-fg" : "text-muted hover-fine:hover:text-fg")}
              >
                {u}
              </button>
            ))}
            {other ? (
              <input value={unit} onChange={(e) => setUnit(e.target.value)} autoFocus aria-label="Cómo se cobra" className="h-8 w-36 rounded-md border border-fg bg-bg px-2.5 text-[13px] outline-none" />
            ) : (
              <button type="button" onClick={() => (setOther(true), setUnit("por "))} className="press h-8 rounded-md border px-2.5 text-[13px] text-muted hover-fine:hover:text-fg">
                otra…
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            {lbl("Precio base", "S/ 5 en 5")}
            <StepBox label="Precio base" value={price} step={5} prefix="S/" minWidth={120} delay={0} onCommit={setPrice} />
          </div>
          <div>
            {lbl("Horas estimadas", "0.5 en 0.5")}
            <StepBox label="Horas estimadas" value={hours} step={0.5} icon={<Clock className="size-3.5" />} unit="h" minWidth={120} delay={0} onCommit={setHours} />
          </div>
        </div>
        <div>
          {lbl("Ciclo de la carrera")}
          <div className="flex gap-0.5 rounded-lg border bg-bg p-[3px]">
            {(["ciclo", "fijo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("press grid h-8 flex-1 place-items-center rounded-[5px] text-[13px] font-medium transition-colors", mode === m ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
              >
                {m === "ciclo" ? "×C sube con el ciclo" : "FIJO mismo precio"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[13px] text-muted">
          {mode === "ciclo" ? (
            <>
              En ciclo 7 costaría <b className="font-mono font-medium text-fg">S/ {money2(at7)}</b> (×{factor7.toFixed(2)}).
            </>
          ) : (
            <>
              En cualquier ciclo cuesta <b className="font-mono font-medium text-fg">S/ {money2(price)}</b>.
            </>
          )}
          {hours > 0 && (
            <>
              {" "}
              Sale <b className="font-mono font-medium text-fg">S/ {money(Math.round(price / hours))}</b> por hora.
            </>
          )}
        </p>
        <button type="submit" hidden />
      </form>
    </SheetContent>
  );
}
