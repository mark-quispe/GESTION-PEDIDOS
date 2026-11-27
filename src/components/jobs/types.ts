import type { JobDetail } from "@/lib/queries/jobs";

/** Lo que llega al navegador: las fechas viajan como texto. */
export type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

export type JobJSON = Jsonify<JobDetail>;

export type Me = { id: string; name: string; isAdmin: boolean; canTake: boolean };

export type HistoryEntry = { id: string; action: string; summary: string | null; entity: string; createdAt: string; userName: string | null };
