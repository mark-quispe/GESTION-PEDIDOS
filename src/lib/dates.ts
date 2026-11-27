import { TIME_ZONE } from "./utils";

/** Fecha de hoy en Perú como "AAAA-MM-DD". */
export function todayLima(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
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
