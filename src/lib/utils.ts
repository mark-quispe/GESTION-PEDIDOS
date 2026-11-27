import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** RNF-06: soles y formatos de Perú. */
export const LOCALE = "es-PE";
export const CURRENCY = "PEN";
export const TIME_ZONE = "America/Lima";

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
export const formatMoney = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : money.format(Number(value));

export const formatDateTime = (value: Date | string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(value))
    : "—";

/** Para fechas sin hora guardadas como "AAAA-MM-DD". */
export const formatDay = (value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  value ? new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";

export const formatBytes = (n: number | null | undefined) => {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};
