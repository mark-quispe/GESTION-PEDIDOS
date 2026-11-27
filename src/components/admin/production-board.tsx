"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MessageCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { createExterno, grantAccess, setExternoActive, updateExterno } from "@/actions/users";
import type { Role } from "@/db/schema";
import type { DoneItem, ProdPeriod, ProdPerson, ProductionData } from "@/lib/queries/production";
import { formatPhone, initials, normalizeText } from "@/lib/domain";
import { dayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DialogRoot, SheetContent } from "@/components/ui/dialog";

type Skill = { code: string; name: string; categoryName: string };

const PERIODS: { value: ProdPeriod; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "3m", label: "3 meses" },
  { value: "ano", label: "Año" },
];
const SHADES = ["var(--fg)", "var(--muted)", "var(--bar)", "var(--border-strong)", "var(--border)"];
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const fmtH = (h: number) => `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(h)} h aprox.`;
/** «Plano cero y valorización» → «Plano cero». */
const shortCat = (c: string) => c.split(/ y | \(/)[0];
const shortSkill = (n: string) => n.split(" ")[0];

function Seg({ value, onChange, options }: { value: ProdPeriod; onChange: (v: ProdPeriod) => void; options: typeof PERIODS }) {
  return (
    <div role="radiogroup" aria-label="Periodo" className="inline-flex rounded-[7px] border bg-surface p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("press h-7 rounded-[5px] px-3 text-[13px] font-medium transition-colors duration-150", o.value === value ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full border bg-line text-xs font-semibold">
      {initials(name)}
    </span>
  );
}

/** RF-18: Producción, igual al Design final. */
export function ProductionBoard({ data, tarifario }: { data: ProductionData; tarifario: Skill[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [period, setPeriod] = useState<ProdPeriod>("mes");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProdPerson | null>(null);

  const periodWord = (p: ProdPeriod) => (p === "semana" ? "esta semana" : p === "mes" ? `en ${data.monthName}` : p === "3m" ? "en 3 meses" : `en ${data.year}`);
  const inPeriod = (p: ProdPeriod) => (i: DoneItem) => dayKey(i.doneAt) >= data.from[p];

  const hoursBy = (p: ProdPeriod) => {
    const m = new Map<string, number>();
    for (const i of data.items.filter(inPeriod(p))) m.set(i.who, (m.get(i.who) ?? 0) + i.hours);
    return m;
  };
  const hours = useMemo(() => hoursBy(period), [period, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = data.people
    .map((p) => ({ p, h: hours.get(p.key) ?? 0 }))
    .filter((x) => x.h > 0)
    .sort((a, b) => b.h - a.h);
  const total = ranked.reduce((a, x) => a + x.h, 0);
  const shown = ranked.length > 5 ? [...ranked.slice(0, 4), { p: { key: "otros", name: `Otros ${ranked.length - 4}` } as ProdPerson, h: ranked.slice(4).reduce((a, x) => a + x.h, 0) }] : ranked;

  const people = [...data.people].sort((a, b) => Number(b.active) - Number(a.active) || (hours.get(b.key) ?? 0) - (hours.get(a.key) ?? 0) || a.name.localeCompare(b.name));
  const tagsOf = (p: ProdPerson) => {
    if (p.kind === "externo") return [...new Set(p.skills.map((c) => shortSkill(data.itemNames[c] ?? c)))].slice(0, 3);
    const cats = new Map<string, number>();
    for (const i of data.items.filter((i) => i.who === p.key)) cats.set(shortCat(i.category), (cats.get(shortCat(i.category)) ?? 0) + i.hours);
    return [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
  };

  const toggleExt = (p: ProdPerson, v: boolean) =>
    start(async () => {
      const r = await setExternoActive(p.id, v);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });

  const open = data.people.find((p) => p.key === openKey) ?? null;

  return (
    <>
      <header className="flex items-end justify-between gap-4 [&_*]:leading-[normal]">
        <div>
          <p className="font-mono text-[11px] text-muted">07 · Producción</p>
          <h1 className="mt-2 mb-1 text-[32px] font-medium tracking-[-0.025em]">Producción</h1>
          <p className="text-sm text-muted">Quienes hacen los trabajos: el equipo con rol Producción y los externos, que no entran a la app.</p>
        </div>
        <button onClick={() => setAdding(true)} className="press inline-flex h-10 items-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-medium whitespace-nowrap text-on-primary">
          + Agregar
        </button>
      </header>

      <section className="enter rounded-lg border bg-surface px-[18px] py-4 [&_*]:leading-[normal]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Horas hechas</h3>
            <p className="mt-[3px] text-xs text-muted">Horas del tarifario de cada ítem que marcaron como hecho {periodWord(period)}, aunque el trabajo siga abierto.</p>
          </div>
          <Seg value={period} onChange={setPeriod} options={PERIODS} />
        </div>
        {total > 0 ? (
          <>
            <div className="flex gap-0.5">
              {shown.map((x, i) => (
                <span
                  key={x.p.key}
                  title={`${x.p.name}: ${fmtH(x.h)}`}
                  className="grow-x h-7 first:rounded-l-md last:rounded-r-md"
                  style={{ flex: x.h, background: SHADES[i], "--i": i } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mt-2.5 flex gap-0.5">
              {shown.map((x, i) => (
                <div key={x.p.key} className="min-w-[88px] overflow-hidden" style={{ flex: x.h }}>
                  <p className="flex items-center gap-1.5 truncate text-[13px] whitespace-nowrap">
                    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: SHADES[i] }} />
                    {x.p.name}
                  </p>
                  <p className="mt-[3px] font-mono text-[13px] whitespace-nowrap">
                    {fmtH(Math.round(x.h * 10) / 10)} <span className="text-muted">· {Math.round((x.h / total) * 100)}%</span>
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid h-[72px] place-items-center rounded-md border border-dashed text-[13px] text-muted">Nadie marcó ítems como hechos {periodWord(period)}.</div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [&_*]:leading-[normal]">
        {people.map((p, idx) => {
          const tags = tagsOf(p);
          const h = hours.get(p.key) ?? 0;
          return (
            <article
              key={p.key}
              onClick={() => setOpenKey(p.key)}
              className={cn("enter row flex cursor-pointer flex-col gap-3.5 rounded-lg border bg-surface p-4 text-left", !p.active && "opacity-50")}
              style={{ "--i": Math.min(idx, 8) } as React.CSSProperties}
            >
              <header className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.name} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-medium">
                      {p.name}
                      {!p.active && <span className="text-xs font-normal text-muted">· inactivo</span>}
                      {p.kind === "externo" && <span className="inline-flex h-5 items-center rounded-full border border-[rgba(163,163,163,.4)] px-[7px] text-[11px] font-normal text-muted">Externo · sin acceso</span>}
                    </p>
                    <p className="mt-[3px] flex items-center gap-1.5 font-mono text-xs text-muted">
                      {p.phone ? (
                        <>
                          <MessageCircle className="size-3" />
                          {formatPhone(p.phone)}
                        </>
                      ) : p.isAdmin ? (
                        "administrador"
                      ) : (
                        "sin celular"
                      )}
                    </p>
                  </div>
                </div>
                <span onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 items-center gap-2 text-xs text-muted" title="Activo: aparece al asignar trabajos">
                  {p.active ? "Activo" : "Inactivo"}
                  <Switch
                    size="md"
                    on={p.active}
                    disabled={pending || p.kind === "usuario"}
                    title={p.kind === "usuario" ? "El acceso de alguien del estudio se cambia en Usuarios" : "Activo: aparece al encargar trabajos"}
                    onChange={(v) => toggleExt(p, v)}
                    label={`Activo · ${p.name}`}
                  />
                </span>
              </header>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex h-[22px] items-center rounded-full border px-2 text-xs text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {p.active ? (
                <>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="font-mono text-[11px] text-muted">En curso ahora</span>
                    <span className="flex items-center gap-2.5 font-mono text-base">
                      <span aria-hidden className="inline-flex gap-[3px]">
                        {Array.from({ length: Math.max(5, p.inProgress) }, (_, i) => (
                          <span key={i} className={cn("h-1 w-2.5 rounded-[2px]", i < p.inProgress ? "bg-fg" : "bg-line")} />
                        ))}
                      </span>
                      {p.inProgress}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[11px] text-muted">Hizo {periodWord(period)}</span>
                    <span className="font-mono text-xl">{fmtH(Math.round(h * 10) / 10)}</span>
                  </div>
                </>
              ) : (
                <p className="border-t border-line pt-3 text-[13px] text-muted">No aparece al asignar trabajos. Sus trabajos pasados se quedan con su nombre.</p>
              )}
            </article>
          );
        })}
      </div>

      <DialogRoot open={!!open} onOpenChange={(v) => !v && setOpenKey(null)}>
        {open && (
          <PersonSheet
            p={open}
            data={data}
            tags={tagsOf(open)}
            hoursBy={hoursBy}
            periodWord={periodWord}
            pending={pending}
            onToggle={(v) => toggleExt(open, v)}
            onEdit={() => {
              setOpenKey(null);
              if (open.kind === "usuario") router.push("/usuarios");
              else setEditing(open);
            }}
          />
        )}
      </DialogRoot>

      <DialogRoot open={adding || !!editing} onOpenChange={(v) => !v && (setAdding(false), setEditing(null))}>
        {(adding || editing) && (
          <AddSheet
            key={editing?.key ?? "nuevo"}
            editing={editing}
            tarifario={tarifario}
            itemNames={data.itemNames}
            onDone={() => {
              setAdding(false);
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </DialogRoot>
    </>
  );
}

/* ---------- Ficha de la persona ---------- */

function PersonSheet({
  p,
  data,
  tags,
  hoursBy,
  periodWord,
  pending,
  onToggle,
  onEdit,
}: {
  p: ProdPerson;
  data: ProductionData;
  tags: string[];
  hoursBy: (p: ProdPeriod) => Map<string, number>;
  periodWord: (p: ProdPeriod) => string;
  pending: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  const [period, setPeriod] = useState<ProdPeriod>("mes");
  const map = hoursBy(period);
  const rank = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const pos = rank.findIndex(([k]) => k === p.key);
  const items = data.items.filter((i) => i.who === p.key && dayKey(i.doneAt) >= data.from[period]).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const day = (iso: string) => `${WEEKDAYS[new Date(`${dayKey(iso)}T12:00:00Z`).getUTCDay()]} ${Number(dayKey(iso).slice(8))}`;

  return (
    <SheetContent
      className="max-w-[420px] bg-side [&_*]:leading-[normal]"
      title={
        <span className="flex items-center gap-3">
          <Avatar name={p.name} size={40} />
          <span className="min-w-0">
            <span className="block text-xl font-medium">{p.name}</span>
            <span className="mt-[3px] block truncate font-mono text-xs font-normal text-muted">{[p.phone ? formatPhone(p.phone) : p.isAdmin ? "administrador" : null, tags.join(", ")].filter(Boolean).join(" · ")}</span>
          </span>
        </span>
      }
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-[13px] text-muted">{p.active ? "Activo" : "Inactivo"}</span>
          <Switch size="md" on={p.active} disabled={pending || p.kind === "usuario"} title={p.kind === "usuario" ? "Se cambia en Usuarios" : undefined} onChange={onToggle} label={`Activo · ${p.name}`} />
          <span className="flex-1" />
          <button onClick={onEdit} className="press inline-flex h-8 items-center rounded-md border bg-surface px-3 text-[13px] font-medium">
            Editar
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-0.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] text-muted">Lo que hizo</p>
          <Seg value={period} onChange={setPeriod} options={PERIODS.filter((x) => x.value !== "semana")} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Horas hechas", fmtH(Math.round((map.get(p.key) ?? 0) * 10) / 10)],
            ["Puesto", pos >= 0 ? `${pos + 1}.º de ${rank.length}` : "—"],
            ["En curso", String(p.inProgress)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-surface px-3 py-2.5">
              <p className="text-xs text-muted">{k}</p>
              <p className="number-pop mt-1 font-mono text-lg">{v}</p>
            </div>
          ))}
        </div>
        {p.note && <p className="rounded-md border border-line px-3 py-2 text-[13px] text-muted">{p.note}</p>}
        <div>
          <p className="font-mono text-[11px] text-muted">Ítems hechos {periodWord(period)}</p>
          <div className="mt-1.5">
            {items.length === 0 && <p className="border-t border-line py-3 text-[13px] text-muted">Todavía no marcó ítems como hechos.</p>}
            {items.map((i) => (
              <Link key={i.id} href={`/trabajos/${i.jobCode}`} className="row -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border-t border-line px-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{i.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {i.jobCode} · {fmtH(i.hours)}
                  </p>
                </div>
                <span className="font-mono text-xs whitespace-nowrap text-muted">{day(i.doneAt)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SheetContent>
  );
}

/* ---------- + Agregar (del estudio o externo) ---------- */

const ROLE_CHIPS: { role: Role; label: string }[] = [
  { role: "produccion", label: "Producción" },
  { role: "empleado", label: "Empleado" },
  { role: "admin", label: "Admin" },
];

function AddSheet({ editing, tarifario, itemNames, onDone }: { editing: ProdPerson | null; tarifario: Skill[]; itemNames: Record<string, string>; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"estudio" | "externo">(editing ? "externo" : "estudio");
  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [roles, setRoles] = useState<Role[]>(["produccion"]);
  const [skills, setSkills] = useState<string[]>(editing?.skills ?? []);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);

  const results = useMemo(() => {
    const t = normalizeText(q);
    if (!t) return [];
    return tarifario
      .filter((s) => !skills.includes(s.code) && (normalizeText(s.code).startsWith(t) || normalizeText(s.name).includes(t) || normalizeText(s.categoryName).includes(t)))
      .slice(0, 6);
  }, [q, tarifario, skills]);

  const toggleRole = (r: Role) =>
    setRoles((prev) => {
      if (r === "admin") return prev.includes("admin") ? ["produccion"] : ["admin"];
      const base = prev.filter((x) => x !== "admin");
      const next = base.includes(r) ? base.filter((x) => x !== r) : [...base, r];
      return next.length ? next : prev;
    });
  const pick = (code: string) => {
    setSkills((s) => [...s, code]);
    setQ("");
    setHi(0);
  };

  const save = () =>
    start(async () => {
      const r =
        tab === "estudio"
          ? await grantAccess({ name, email, phone, roles })
          : editing
            ? await updateExterno(editing.id, { name, phone, note, skills })
            : await createExterno({ name, phone, note, skills });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Cambios guardados." : tab === "estudio" ? `${name || email} ya puede entrar.` : `${name} ya aparece al encargar trabajos.`);
      onDone();
    });

  const label = (t: string, hint?: string) => (
    <span className="mb-1.5 flex justify-between text-[13px] text-muted">
      <span>{t}</span>
      {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
    </span>
  );
  const inputCls = "h-10 w-full rounded-md border bg-bg px-3 text-sm outline-none placeholder:text-faint focus:border-muted";
  const sub =
    tab === "estudio"
      ? [email || "correo@gmail.com"]
      : [phone ? formatPhone(phone) : null, skills.map((c) => shortSkill(itemNames[c] ?? c)).join(", ") || null].filter(Boolean);

  return (
    <SheetContent
      className="max-w-[420px] bg-side [&_*]:leading-[normal]"
      eyebrow={editing ? "07 · Producción · editar" : "07 · Producción · nuevo"}
      title={editing ? `Editar a ${editing.name}` : "Agregar a Producción"}
      footer={
        <div className="flex w-full items-center gap-2">
          <button onClick={onDone} className="press inline-flex h-8 items-center rounded-md border bg-surface px-3 text-[13px] font-medium">
            Cancelar
          </button>
          <span className="flex-1" />
          <button onClick={save} disabled={pending || name.trim().length < 2 || (tab === "estudio" && !email)} className="press inline-flex h-8 items-center rounded-md border border-primary bg-primary px-3 text-[13px] font-medium text-on-primary disabled:opacity-45">
            Guardar
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), save())} className="flex flex-col gap-[18px] py-1">
        {!editing && (
          <div className="flex gap-0.5 rounded-lg border bg-bg p-[3px]">
            {(["estudio", "externo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn("press grid h-8 flex-1 place-items-center rounded-[5px] text-[13px] font-medium transition-colors", tab === t ? "bg-line text-fg" : "text-muted hover-fine:hover:text-fg")}
              >
                {t === "estudio" ? "Del estudio · con cuenta" : "Externo · sin acceso"}
              </button>
            ))}
          </div>
        )}
        <p className="text-[13px] !leading-[1.5] text-muted">
          {tab === "estudio" ? (
            <>
              Alguien del estudio que entra a la app con su Gmail. Con rol Producción puede <b className="font-semibold text-fg">tomar</b> trabajos del pozo.
            </>
          ) : (
            "Alguien de fuera del estudio, contratado aparte para un trabajo puntual. No entra a la app: Empleado o Producción le encarga el trabajo y lo sigue por él."
          )}
        </p>
        <label className="block">
          {label("Nombre")}
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus required />
        </label>
        {tab === "estudio" && (
          <label className="block">
            {label("Gmail")}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="correo@gmail.com" className={inputCls} />
          </label>
        )}
        <label className="block">
          {label("Celular", "opcional")}
          <span className="relative block">
            {tab === "externo" && <MessageCircle className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />}
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="987 654 321" className={cn(inputCls, tab === "externo" && "pl-8")} />
          </span>
        </label>
        {tab === "estudio" ? (
          <div>
            <p className="mb-1.5 font-mono text-[11px] text-muted">
              Roles <span className="text-faint">· puede tener varios</span>
            </p>
            <div className="flex gap-1.5">
              {ROLE_CHIPS.map((c) => {
                const on = roles.includes(c.role);
                return (
                  <button
                    key={c.role}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRole(c.role)}
                    className={cn("press inline-flex h-8 items-center rounded-md border px-3 text-[13px] transition-colors", on ? "border-fg bg-bg text-fg" : "bg-surface text-muted hover-fine:hover:text-fg")}
                  >
                    {on && "✓ "}
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">Producción = todo lo del empleado + Tomar. Solo Empleado no puede tomar trabajos.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 flex justify-between text-[13px] text-muted">
                <span>Qué hace</span>
                <span className="font-mono text-[11px] text-faint">opcional · varias</span>
              </p>
              {skills.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {skills.map((c) => (
                    <span key={c} className="pop-in inline-flex h-[30px] items-center gap-[7px] rounded-md border border-muted bg-line pr-2 pl-2.5 text-[12.5px] whitespace-nowrap">
                      <span className="font-mono text-[10.5px] text-muted">{c}</span>
                      {itemNames[c] ?? c}
                      <button type="button" aria-label={`Quitar ${c}`} onClick={() => setSkills((s) => s.filter((x) => x !== c))} className="text-faint hover-fine:hover:text-fg">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="overflow-hidden rounded-md border bg-bg focus-within:border-muted">
                <div className="flex h-10 items-center gap-2 px-3 text-sm">
                  <Search className="size-3.5 text-faint" />
                  <input
                    value={q}
                    onChange={(e) => (setQ(e.target.value), setHi(0))}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
                      if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                      if (e.key === "Enter" && results[hi]) { e.preventDefault(); pick(results[hi].code); }
                    }}
                    placeholder="código o nombre del tarifario"
                    aria-label="Buscar en el tarifario"
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
                  />
                </div>
                {results.length > 0 && (
                  <div className="border-t border-line">
                    {results.map((s, i) => (
                      <button
                        key={s.code}
                        type="button"
                        onMouseEnter={() => setHi(i)}
                        onClick={() => pick(s.code)}
                        className={cn("grid w-full grid-cols-[52px_1fr_auto] items-center gap-2.5 px-3 py-2 text-left text-[13px]", i === hi && "bg-line")}
                      >
                        <span className="font-mono text-[11px] text-muted">{s.code}</span>
                        <span>{s.name}</span>
                        <span className="font-mono text-[11px] text-faint">{shortCat(s.categoryName)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-faint">Mismo buscador que al registrar un trabajo. Sirve para sugerirlo al encargar.</p>
            </div>
            <label className="block">
              {label("Nota", "opcional")}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ej.: trabaja desde casa, entrega los lunes" className="min-h-16 w-full resize-none rounded-md border bg-bg px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-muted" />
            </label>
          </>
        )}
        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <p className="font-mono text-[11px] text-muted">Así se verá</p>
          <div className="flex items-center justify-between rounded-lg border bg-surface p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={name || "?"} size={36} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {name || "Nombre"}
                  <span className="inline-flex h-5 items-center rounded-full border border-[rgba(163,163,163,.4)] px-[7px] text-[11px] font-normal text-muted">
                    {tab === "estudio" ? `${roles.includes("admin") ? "Admin" : roles.includes("produccion") ? "Producción" : "Empleado"} · con cuenta` : "Externo · sin acceso"}
                  </span>
                </p>
                <p className="mt-[3px] truncate font-mono text-xs text-muted">{sub.join(" · ") || "—"}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted">{editing ? `${editing.inProgress} en curso` : "0 en curso"}</span>
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </SheetContent>
  );
}

