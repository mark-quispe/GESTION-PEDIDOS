import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { externos, serviceCategories, serviceItems } from "@/db/schema";

export type TarifaItem = {
  id: string;
  code: string;
  name: string;
  includes: string | null;
  unit: string;
  hours: number | null;
  pricingMode: "fijo" | "ciclo";
  basePrice: number;
  categoryCode: string;
  categoryName: string;
  isCustom: boolean;
};

/** Tarifario activo, en el orden de Servicios (Personalizado siempre al final). */
export async function getTarifario(): Promise<TarifaItem[]> {
  const rows = await db
    .select({
      id: serviceItems.id,
      code: serviceItems.code,
      name: serviceItems.name,
      includes: serviceItems.includes,
      unit: serviceItems.unit,
      hours: serviceItems.hours,
      pricingMode: serviceItems.pricingMode,
      basePrice: serviceItems.basePrice,
      categoryCode: serviceCategories.code,
      categoryName: serviceCategories.name,
      isCustom: serviceCategories.isCustom,
    })
    .from(serviceItems)
    .innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.categoryId))
    .where(eq(serviceItems.active, true))
    .orderBy(asc(serviceCategories.isCustom), asc(serviceCategories.sortOrder), asc(serviceItems.sortOrder));
  return rows;
}

export async function listExternos() {
  return db.select({ id: externos.id, name: externos.name, phone: externos.phone, skills: externos.skills }).from(externos).where(eq(externos.active, true)).orderBy(asc(externos.name));
}
