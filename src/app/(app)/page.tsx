import { requireUser } from "@/lib/auth-guard";
import { getDashboard } from "@/lib/queries/dashboard";
import { isoWeek, monthLong, todayLima, weekdayLong } from "@/lib/dates";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { JobActionButtons } from "@/components/jobs/job-buttons";
import {
  FinishedWeekCard,
  LateCard,
  LoadQuotesCard,
  MoneyCard,
  PendingCard,
  PoolCard,
  PriorityLegend,
  QuotesCard,
  ToSendCard,
  WeekStrip,
} from "@/components/home/cards";

export const metadata = { title: "Inicio" };

/** RF-19, RF-20, RF-49, RF-50: lo que hay que entregar, cobrar y responder. */
export default async function HomePage() {
  const user = await requireUser();
  const admin = user.isAdmin && !user.viewAsEmployee;
  const d = await getDashboard(admin);
  const today = todayLima();
  const noon = new Date(`${today}T12:00:00-05:00`);
  const eyebrow = `${weekdayLong(noon)}, ${Number(today.slice(8))} de ${monthLong(noon)} · semana ${isoWeek(today)}`;

  return (
    <PageBody>
      <PageHeader n="01" eyebrow={eyebrow} title="Inicio" description="Lo que hay que entregar, cobrar y responder." actions={<JobActionButtons size="lg" long />} />
      <PriorityLegend />
      <WeekStrip week={d.week} />
      {admin ? (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)] xl:grid-rows-[268px_268px]">
          <div className="flex min-h-0 flex-col gap-3.5" style={{ "--i": 1 } as React.CSSProperties}>
            <LateCard rows={d.late} className="max-h-[360px] min-h-[150px] flex-1 xl:max-h-none" />
            {d.toSend.length > 0 && <ToSendCard rows={d.toSend} className="max-h-[220px] shrink-0" />}
          </div>
          <LoadQuotesCard load={d.load} quotes={d.quotes} badge={d.alerts.quotes} className="max-h-[360px] xl:max-h-none" />
          <MoneyCard money={d.money!} className="min-h-0 md:col-span-2 xl:col-span-1 xl:row-span-2" />
          <PendingCard data={d.pending} badge={d.alerts.pending} className="max-h-[360px] xl:max-h-none" />
          <PoolCard pool={d.pool} hot={d.hot} canTake={user.canTake} className="max-h-[420px] xl:max-h-none" />
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 xl:grid-rows-[268px_268px]">
          <LateCard rows={d.late} className="max-h-[360px] xl:max-h-none" />
          <QuotesCard rows={d.quotes} badge={d.alerts.quotes} className="max-h-[360px] xl:max-h-none" />
          <ToSendCard rows={d.toSend} className="max-h-[360px] xl:max-h-none" />
          <PendingCard data={d.pending} badge={d.alerts.pending} className="max-h-[360px] xl:max-h-none" />
          <PoolCard pool={d.pool} hot={d.hot} canTake={user.canTake} className="max-h-[420px] xl:max-h-none" />
          <FinishedWeekCard rows={d.finishedWeek} className="max-h-[360px] xl:max-h-none" />
        </div>
      )}
    </PageBody>
  );
}
