import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { getStats, PERIOD_LABEL, type StatsPeriod } from "@/lib/queries/stats";
import { METHOD_LABEL, initials } from "@/lib/domain";
import { dayMonth } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { PageBody } from "@/components/layout/page-header";
import { Bars, ChartCard, Donut, HBars, Legend, Line, Spark, Stacked } from "@/components/stats/charts";

export const metadata = { title: "Estadísticas" };

const PAY_COLOR = { yape: "var(--pay-yape)", plin: "var(--pay-plin)", transferencia: "var(--pay-transferencia)", efectivo: "var(--pay-efectivo)" } as const;
const soles = (v: number) => `S/ ${Math.round(v).toLocaleString("es-PE")}`;

function Delta({ now, prev, unit = "", invert }: { now: number; prev: number; unit?: string; invert?: boolean }) {
  if (!prev && !now) return null;
  const diff = Math.round((now - prev) * 10) / 10;
  if (diff === 0) return <span className="font-mono text-[11px] text-faint">= igual</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={cn("font-mono text-[11px]", good ? "text-success" : "text-danger")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("es-PE")}
      {unit}
    </span>
  );
}

/** RF-51: cómo le va al estudio. Solo el administrador. */
export default async function StatsPage({ searchParams }: PageProps<"/estadisticas">) {
  await requireUser("admin");
  const sp = await searchParams;
  const period: StatsPeriod = sp.p === "1s" || sp.p === "4s" || sp.p === "todo" ? sp.p : "12s";
  const s = await getStats(period);
  const vs = period === "1s" ? "vs semana pasada" : period === "todo" ? "" : `vs ${PERIOD_LABEL[period]} anteriores`;
  const pl = PERIOD_LABEL[period].toLowerCase();
  const topMethod = [...s.methods].sort((a, b) => b.total - a.total);
  const bestBucket = s.incomeSeries.reduce((m, x) => (x.value > m.value ? x : m), s.incomeSeries[0] ?? { label: "", value: 0 });
  const busiest = [...s.weekdays].sort((a, b) => b.value - a.value);

  return (
    <PageBody className="gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <p className="mb-1.5 font-mono text-xs text-muted">06 · Solo administrador</p>
          <h1 className="text-[28px] leading-tight font-medium tracking-[-0.025em] md:text-[30px]">Estadísticas</h1>
          <p className="mt-1 text-sm text-muted">
            Cómo le va al estudio · {dayMonth(`${s.from}T12:00:00-05:00`)} – {dayMonth(`${s.to}T12:00:00-05:00`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Periodo" className="flex gap-0.5 rounded-[7px] border bg-bg p-0.5">
            {(["1s", "4s", "12s", "todo"] as StatsPeriod[]).map((p) => (
              <Link key={p} href={`/estadisticas?p=${p}`} role="radio" aria-checked={p === period} className={cn("press h-8 content-center rounded-[5px] px-3 text-[13px] font-medium", p === period ? "bg-line" : "text-muted hover-fine:hover:text-fg")}>
                {PERIOD_LABEL[p]}
              </Link>
            ))}
          </div>
          <a href={`/api/estadisticas?p=${period}`} className="press inline-flex h-9 items-center gap-2 rounded-md border bg-surface px-3 text-[13px] font-medium hover-fine:hover:border-border-strong">
            <Download className="size-3.5" /> Descargar Excel
          </a>
        </div>
      </header>

      {/* Números clave */}
      <section className="grid grid-cols-2 overflow-hidden rounded-lg border bg-surface md:grid-cols-5 [&>*]:border-line [&>*]:px-4 [&>*]:py-3.5 md:[&>*:not(:last-child)]:border-r [&>*:nth-child(odd)]:border-r max-md:[&>*:nth-child(n+3)]:border-t">
        <Key label={`Ingresos · ${pl}`} value={soles(s.keys.income)} sub={<>esta semana {soles(s.keys.incomeThisWeek)}</>} delta={vs && <Delta now={s.keys.income} prev={s.keys.incomePrev} />} />
        <Key label="Trabajos finalizados" value={s.keys.finished} sub={`${s.keys.perWeek} por ${s.byDay ? "semana" : "semana"} en promedio`} delta={vs && <Delta now={s.keys.finished} prev={s.keys.finishedPrev} />} />
        <Key label="Precio promedio" value={soles(s.keys.avgPrice)} sub="por trabajo" />
        <Key label="Cotizaciones concretadas" value={`${s.keys.conversion}%`} sub={`${s.keys.quotesWon} de ${s.keys.quotesTotal}`} />
        <Key label="Tiempo promedio de entrega" value={`${s.keys.leadDays} días`} sub="de registrado a finalizado" delta={vs && <Delta now={s.keys.leadDays} prev={s.keys.leadDaysPrev} unit=" d" invert />} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Preferencia de pago" aside={pl} i={1} note={s.unreviewed ? <Link href="/pagos?f=revisar" className="text-warning">{s.unreviewed} pagos sin revisar · Ver en Pagos</Link> : undefined}>
          <div className="flex flex-wrap items-center gap-5">
            <Donut
              data={s.methods.map((m) => ({ label: METHOD_LABEL[m.method], value: m.total, color: PAY_COLOR[m.method] }))}
              center={
                <>
                  <span className="block font-mono text-[11px] text-muted">total</span>
                  <span className="block text-sm font-medium">{soles(s.methods.reduce((a, m) => a + m.total, 0))}</span>
                </>
              }
            />
            <table className="min-w-0 flex-1 text-[13px]">
              <thead>
                <tr className="font-mono text-[10.5px] text-muted">
                  <th className="pb-1.5 text-left font-normal">Medio</th>
                  <th className="pb-1.5 text-right font-normal">Total</th>
                  <th className="pb-1.5 text-right font-normal">Pagos</th>
                  <th className="pb-1.5 text-right font-normal">Promedio</th>
                </tr>
              </thead>
              <tbody>
                {s.methods.map((m) => (
                  <tr key={m.method} className="border-t border-line">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: PAY_COLOR[m.method] }} />
                        {METHOD_LABEL[m.method]}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{soles(m.total)}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{m.count}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{soles(m.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Días con más pedidos" aside={pl} i={2} note={busiest[0]?.value ? `El ${busiest[0].label.toLowerCase()} entra más; el ${busiest[6].label.toLowerCase()}, menos.` : undefined}>
          <Bars data={s.weekdays} highlightLast={false} />
        </ChartCard>
        <ChartCard title="Cuánto entra por cada medio" aside={`${pl} · total, pagos y promedio`} i={3}>
          <div className="grid gap-2 sm:grid-cols-2">
            {topMethod.map((m) => (
              <div key={m.method} className="rounded-md border bg-bg px-3 py-2.5">
                <p className="flex items-center justify-between text-[13px]">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: PAY_COLOR[m.method] }} />
                    {METHOD_LABEL[m.method]}
                  </span>
                  <span className="font-mono text-xs text-muted">{m.pct} %</span>
                </p>
                <p className="mt-1 font-mono text-lg">{soles(m.total)}</p>
                <p className="text-xs text-faint">
                  {m.count} pagos · promedio {soles(m.avg)}
                </p>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
                  <span className="grow-x block h-full" style={{ width: `${m.pct}%`, background: PAY_COLOR[m.method] }} />
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Tiempo promedio de entrega" aside="días promedio, por servicio" i={4}>
          {s.leadCats.length ? <HBars data={s.leadCats} format={(v) => `${v} d`} /> : <Empty />}
        </ChartCard>
        <ChartCard title={s.byDay ? "Ingresos en la semana" : "Ingresos por semana"} aside={pl} i={5} note={bestBucket?.value ? `${s.byDay ? "El" : "La semana del"} ${bestBucket.label} fue ${s.byDay ? "el día" : ""} más fuerte.` : undefined}>
          <Bars data={s.incomeSeries} format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)))} />
        </ChartCard>
        <ChartCard title="Cotizaciones" aside={pl} i={6}>
          <div className="flex gap-6 text-[13px]">
            <span>
              <span className="block font-mono text-xl">{s.quotes.won}</span>
              <span className="text-muted">concretadas</span>
            </span>
            <span>
              <span className="block font-mono text-xl text-warning">{s.quotes.open}</span>
              <span className="text-muted">sin respuesta</span>
            </span>
            <span>
              <span className="block font-mono text-xl text-faint">{s.quotes.lost}</span>
              <span className="text-muted">canceladas</span>
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted">Concretadas por {s.byDay ? "día" : "semana"}</p>
          <Bars data={s.quotes.series} height={100} />
        </ChartCard>
      </div>

      <ChartCard title="Desempeño del equipo" aside={`${pl} · quién toma más pedidos`} note="Cada tarjeta lleva su columna (pedidos tomados, comparables entre personas) y la línea del periodo. Sin atrasos por persona: un atraso es del trabajo.">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
          {s.team.map((p, i) => {
            const max = Math.max(1, ...s.team.map((x) => x.taken));
            return (
              <div key={p.id} className="flex flex-col gap-2 rounded-md border bg-bg p-3">
                <p className="flex items-center gap-2 text-[13px]">
                  <span className={cn("grid size-7 place-items-center rounded-full border bg-surface text-[10px] font-semibold", p.ext && "border-dashed")}>{initials(p.name)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name.split(" ")[0]}</span>
                  <span className="font-mono text-[11px] text-faint">#{i + 1}</span>
                </p>
                <div className="flex items-end gap-3">
                  <span className="flex h-14 w-3 items-end overflow-hidden rounded-sm bg-line">
                    <span className="grow-y block w-full rounded-sm bg-fg" style={{ height: `${(p.taken / max) * 100}%` }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-2xl leading-none">{p.taken}</span>
                    <span className="block text-xs text-muted">pedidos tomados</span>
                  </span>
                  <Spark values={p.series} width={64} height={28} />
                </div>
                <p className="text-xs text-muted">
                  {p.items} ítems · {p.hours} h · soltó {p.released}
                </p>
                <p className="font-mono text-[10.5px] text-faint">{p.role}</p>
              </div>
            );
          })}
        </div>
      </ChartCard>

      <SectionTitle title="Servicios" sub="qué se pide y cómo se trabaja" />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <ChartCard title="Ítems más pedidos" aside={`top 10 · ${pl}`}>
          {s.topItems.length ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10.5px] text-muted">
                  <th className="pb-1.5 font-normal">Código</th>
                  <th className="pb-1.5 font-normal">Ítem</th>
                  <th className="pb-1.5 text-right font-normal">Veces</th>
                  <th className="pb-1.5 text-right font-normal">Dejó</th>
                  {vs && <th className="pb-1.5 text-right font-normal">{vs}</th>}
                </tr>
              </thead>
              <tbody>
                {s.topItems.map((it) => (
                  <tr key={it.code} className="border-t border-line">
                    <td className="py-1.5 font-mono text-xs text-muted">{it.code}</td>
                    <td className="max-w-56 truncate py-1.5">{it.name}</td>
                    <td className="py-1.5 text-right font-mono">{it.times}</td>
                    <td className="py-1.5 text-right font-mono text-muted">{soles(it.amount)}</td>
                    {vs && <td className={cn("py-1.5 text-right font-mono text-xs", it.delta > 0 ? "text-success" : it.delta < 0 ? "text-danger" : "text-faint")}>{it.delta > 0 ? `▲ ${it.delta}` : it.delta < 0 ? `▼ ${-it.delta}` : "= 0"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </ChartCard>
        <div className="flex flex-col gap-4">
          <ChartCard title="Por ciclo de la carrera" aside="pedidos por categoría" note="Útil para saber a quién ofrecer qué.">
            {s.byCycle.length ? <Heat rows={s.byCycle} /> : <Empty />}
          </ChartCard>
          <ChartCard title="Se piden juntos" aside="pares de ítems" note="De cada 100 que piden el primero, cuántos piden también el segundo. Idea para paquetes.">
            {s.together.length ? (
              <HBars data={s.together.map((t) => ({ label: `${t.a} + ${t.b}`, value: t.pct }))} format={(v) => `${v} %`} max={100} />
            ) : (
              <Empty />
            )}
          </ChartCard>
        </div>
      </div>

      <SectionTitle title="Clientes, pagos y entregas" />
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Tiempo promedio en tomar un pedido" aside="desde que cae en Por tomar" note={`Promedio ${s.take.avg} h · ${s.take.waitedLong} pedidos esperaron más de 24 h. Si la línea sube, falta gente en Producción.`}>
          <Line values={s.take.series.map((x) => x.value)} labels={s.bucketLabels} height={110} format={(v) => `${Math.round(v)}h`} />
          <div className="grid grid-cols-3 gap-2 text-[13px]">
            {s.take.byUrgency.map((u) => (
              <span key={u.urgency} className="rounded-md border bg-bg px-2.5 py-2">
                <span className={cn("block text-xs", u.urgency === "urgente" ? "text-danger" : u.urgency === "alta" ? "text-warning" : "text-muted")}>{u.urgency === "urgente" ? "Urgente" : u.urgency === "alta" ? "Alta" : "Normal"}</span>
                <span className="font-mono">{u.hours} h</span>
              </span>
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Clientes que más piden" aside={pl}>
          {s.topClients.length ? <HBars data={s.topClients} /> : <Empty />}
        </ChartCard>
        <ChartCard title="Entregas a tiempo" aside={`% de trabajos por ${s.byDay ? "día" : "semana"}`} note="El atraso se cuenta por trabajo, no por persona.">
          <div className="flex gap-6 text-[13px]">
            <span>
              <span className="block font-mono text-xl">{s.onTime.pct}%</span>
              <span className="text-muted">{pl}</span>
            </span>
            <span>
              <span className="block font-mono text-xl text-danger">{s.onTime.late}</span>
              <span className="text-muted">con atraso</span>
            </span>
          </div>
          <Line values={s.onTime.series.map((x) => x.value)} labels={s.bucketLabels} height={100} format={(v) => `${Math.round(v)}%`} />
        </ChartCard>
        <ChartCard title="Urgencia y recargo" aside="trabajos · recargo" note={`El recargo dejó ${soles(s.urgency.reduce((a, u) => a + u.surcharge, 0))}${s.loweredUrgency ? ` · ${s.loweredUrgency} urgentes se bajaron a Normal` : ""}.`}>
          <HBars
            data={s.urgency.map((u) => ({ label: `${u.urgency === "normal" ? "Normal" : u.urgency === "alta" ? "Alta" : "Urgente"} · ${u.count}`, value: u.surcharge, tone: u.urgency === "urgente" ? "var(--danger)" : u.urgency === "alta" ? "var(--warning)" : "var(--bar)" }))}
            format={soles}
          />
        </ChartCard>
        <ChartCard title="Pendientes por cobrar" aside="antigüedad" note={`Total ${soles(s.pendingAge.reduce((a, b) => a + b.total, 0))} en ${s.pendingAge.reduce((a, b) => a + b.count, 0)} trabajos finalizados. En ámbar, los que pasan de 3 días.`}>
          <HBars data={s.pendingAge.map((b) => ({ label: b.label, value: b.total, tone: b.warn ? "var(--warning)" : "var(--bar)" }))} format={soles} />
        </ChartCard>
        <ChartCard title="Clientes nuevos y que vuelven" aside={`${s.returningPct}% ya había pedido antes`}>
          <Legend
            items={[
              { label: "Nuevos", color: "var(--bar)" },
              { label: "Ya habían pedido", color: "var(--fg)" },
            ]}
          />
          <Stacked
            data={s.newVsReturning}
            keys={[
              { key: "fresh", color: "var(--bar)", label: "Nuevos" },
              { key: "back", color: "var(--fg)", label: "Ya habían pedido" },
            ]}
            height={110}
          />
        </ChartCard>
      </div>

      <SectionTitle title="Dinero y correcciones" sub="lo que entró, lo que salió y cómo se trabajó" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Dinero que entra y sale" aside={pl} note={s.money.extrasPaid ? `Los pagos incluyen ${soles(s.money.extrasPaid)} de extras por correcciones. El precio pactado no cambia con extras.` : "Cada movimiento suma o resta aparte; los pagos anulados no cuentan."}>
          <dl className="flex flex-col gap-2 text-[13px]">
            <MoneyRow label="Pagos recibidos" value={soles(s.money.received)} />
            <MoneyRow label="Devoluciones" value={`−${soles(s.money.refunds)}`} tone="text-danger" />
            <MoneyRow label="Pagos anulados" value={`−${soles(s.money.voided)}`} tone="text-danger" />
            <MoneyRow label="Ingreso neto" value={soles(s.money.net)} strong />
          </dl>
        </ChartCard>
        <ChartCard title="Motivo de pedidos anulados" aside={pl} note={s.cancelReasons.length ? `${s.cancelReasons.reduce((a, r) => a + r.count, 0)} anulados · el estudio se quedó con ${soles(s.cancelReasons.reduce((a, r) => a + r.kept, 0))}` : undefined}>
          {s.cancelReasons.length ? <HBars data={s.cancelReasons.map((r) => ({ label: r.label, value: r.count, sub: `· ${soles(r.kept)}` }))} /> : <Empty>Ningún pedido anulado en este periodo.</Empty>}
        </ChartCard>
        <ChartCard title="Correcciones por semana" aside="rondas pedidas">
          <Legend
            items={[
              { label: "Incluida (ronda 1–2)", color: "var(--fg)" },
              { label: "Pedido extra · cobrado", color: "var(--warning)" },
              { label: "Error del estudio · no se cobra", color: "var(--danger)" },
            ]}
          />
          <Stacked
            data={s.correctionSeries}
            keys={[
              { key: "incl", color: "var(--fg)", label: "Incluida" },
              { key: "paid", color: "var(--warning)", label: "Cobrada" },
              { key: "error", color: "var(--danger)", label: "Error del estudio" },
            ]}
            height={120}
          />
        </ChartCard>
        <ChartCard title="Precios cambiados" aside={pl}>
          <div className="flex gap-6 text-[13px]">
            <span>
              <span className="block font-mono text-xl">{s.prices.count}</span>
              <span className="text-muted">cambios de precio</span>
            </span>
            <span>
              <span className="block font-mono text-xl text-warning">{soles(s.prices.down)}</span>
              <span className="text-muted">se dejó de cobrar</span>
            </span>
            <span>
              <span className="block font-mono text-xl">+{soles(s.prices.up)}</span>
              <span className="text-muted">subidas</span>
            </span>
          </div>
          {s.prices.lowered.length > 0 && (
            <>
              <p className="font-mono text-[11px] text-muted">Quién bajó precios</p>
              <HBars data={s.prices.lowered.map((l) => ({ label: l.name, value: l.amount, sub: `· ${l.count}` }))} format={soles} />
            </>
          )}
          <Link href="/pagos?p=mes&f=precios" className="text-xs text-info">
            Ver cada cambio con su motivo en Pagos →
          </Link>
        </ChartCard>
      </div>
    </PageBody>
  );
}

function Key({ label, value, sub, delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-faint">
        {sub}
        {delta}
      </p>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <h2 className="-mb-2 flex items-baseline gap-3 border-b border-line pb-2 text-lg font-medium">
      {title}
      {sub && <span className="text-[13px] font-normal text-muted">{sub}</span>}
    </h2>
  );
}

function MoneyRow({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between", strong && "border-t pt-2")}>
      <dt className={strong ? "font-medium" : "text-muted"}>{label}</dt>
      <dd className={cn("font-mono", tone, strong && "text-lg")}>{value}</dd>
    </div>
  );
}

function Heat({ rows }: { rows: { label: string; values: number[] }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-[11.5px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: 10 }, (_, i) => (
              <th key={i} className="pb-1 font-mono font-normal text-faint">
                c{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-2 whitespace-nowrap text-muted">{r.label}</td>
              {r.values.map((v, i) => {
                const a = v / max;
                return (
                  <td key={i} title={`${r.label} · ciclo ${i + 1}: ${v}`} className="h-6 min-w-6 rounded-[3px] text-center font-mono" style={{ background: v ? `color-mix(in srgb, var(--fg) ${Math.round(12 + a * 78)}%, transparent)` : "var(--line)", color: a > 0.5 ? "var(--bg)" : "var(--fg-2)" }}>
                    {v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children = "Todavía no hay datos para este periodo." }: { children?: React.ReactNode }) {
  return <p className="py-4 text-center text-[13px] text-faint">{children}</p>;
}
