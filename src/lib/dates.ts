import { TIME_ZONE } from "./utils";

/**
 * Fechas en hora de Perú (RNF-06). Perú no tiene horario de verano: UTC−5 todo el año,
 * así que las cuentas de días se hacen con un desplazamiento fijo.
 */
const OFFSET_MS = -5 * 3_600_000;

/** Fecha de hoy en Perú como "AAAA-MM-DD". */
export function todayLima(now = new Date()): string {
  return dayKey(now);
}

/** "AAAA-MM-DD" del día en Perú de un instante. */
export function dayKey(d: Date | string): string {
  return new Date(new Date(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Año actual en Perú (para el código del trabajo, RF-08). */
export function yearLima(now = new Date()): number {
  return Number(todayLima(now).slice(0, 4));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Instante (UTC) de una fecha y hora de Perú. */
export function limaInstant(day: string, time = "00:00"): Date {
  return new Date(`${day}T${time}:00-05:00`);
}

/** Inicio del día en Perú. */
export function startOfDayLima(day: string) {
  return limaInstant(day, "00:00");
}

/** Lunes de la semana de `day`. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(day, -dow);
}

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Número de semana ISO. */
export function isoWeek(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-PE", { timeZone: TIME_ZONE, ...opts });
const fWeekday = fmt({ weekday: "short" });
const fWeekdayLong = fmt({ weekday: "long" });
const fMonthLong = fmt({ month: "long" });
const fMonthShort = fmt({ month: "short" });
const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clean = (s: string) => s.replace(".", "");

/** "Sáb" */
export const weekdayShort = (d: Date | string) => cap(clean(fWeekday.format(new Date(d))));
/** "sábado" */
export const weekdayLong = (d: Date | string) => fWeekdayLong.format(new Date(d)).toLowerCase();
/** "noviembre" */
export const monthLong = (d: Date | string) => fMonthLong.format(new Date(d)).toLowerCase();
/** "18:00" */
export const timeLima = (d: Date | string) => fTime.format(new Date(d));
/** "21 nov" */
export const dayMonth = (d: Date | string) => `${Number(dayKey(d).slice(8))} ${clean(fMonthShort.format(new Date(d))).toLowerCase()}`;
/** "21/11" */
export const dayMonthNum = (d: Date | string) => `${dayKey(d).slice(8)}/${dayKey(d).slice(5, 7)}`;

/** Día de la semana de un "AAAA-MM-DD" ("Sáb 21"). */
export function dayLabel(day: string) {
  const d = limaInstant(day, "12:00");
  return `${weekdayShort(d)} ${Number(day.slice(8))}`;
}

/**
 * Fecha de entrega como se lee en las listas: "Hoy 18:00", "Mañana", "Dom 22", "19 nov".
 */
export function dueLabel(dueAt: Date | string, now = new Date(), withTime = false) {
  const today = todayLima(now);
  const k = dayKey(dueAt);
  const diff = daysBetween(today, k);
  const t = timeLima(dueAt);
  if (diff === 0) return withTime ? `Hoy ${t}` : "Hoy";
  if (diff === 1) return withTime ? `Mañana ${t}` : "Mañana";
  if (diff > 1 && diff < 7) return `${weekdayShort(dueAt)} ${Number(k.slice(8))}`;
  return dayMonth(dueAt);
}

/** "hace 5 días", "hace 3 h", "hace un momento". */
export function timeAgo(d: Date | string, now = new Date()) {
  const ms = now.getTime() - new Date(d).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 2) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = daysBetween(dayKey(d), todayLima(now));
  if (days <= 1) return "ayer";
  return `hace ${days} días`;
}
