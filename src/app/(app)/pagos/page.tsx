import { requireUser } from "@/lib/auth-guard";
import { listPayments, priceChanges } from "@/lib/queries/payments";
import { addDays, monthStart, todayLima, weekStart } from "@/lib/dates";
import { PageBody } from "@/components/layout/page-header";
import { PaymentsBoard, type Period } from "@/components/payments/payments-board";

export const metadata = { title: "Pagos" };

function range(period: Period, d: string) {
  if (period === "semana") {
    const from = weekStart(d);
    return { from, to: addDays(from, 7) };
  }
  if (period === "mes") {
    const from = monthStart(d);
    const next = new Date(`${from}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from, to: next.toISOString().slice(0, 10) };
  }
  return { from: d, to: addDays(d, 1) };
}

/** RF-15: revisar los pagos contra Yape y el banco; solo admin. */
export default async function PagosPage({ searchParams }: PageProps<"/pagos">) {
  await requireUser("admin");
  const sp = await searchParams;
  const period: Period = sp.p === "semana" || sp.p === "mes" ? sp.p : "dia";
  const day = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayLima();
  const { from, to } = range(period, day);
  const [rows, changes] = await Promise.all([listPayments(from, to), priceChanges(from, to)]);
  return (
    <PageBody>
      <PaymentsBoard
        rows={rows}
        changes={changes.map((c) => ({ ...c, at: c.at.toISOString() }))}
        period={period}
        day={day}
        from={from}
        to={to}
        today={todayLima()}
        initialFilter={sp.f === "precios" ? "precios" : sp.f === "revisar" ? "revisar" : "todos"}
      />
    </PageBody>
  );
}
