import { z } from "zod";
import { JOB_STATUSES, URGENCIES } from "@/lib/domain";
import { optionalDay, optionalMoney, optionalText, optionalUuid } from "./common";

export const jobSchema = z.object({
  clientId: z.uuid("Elige un cliente"),
  serviceTypeId: z.uuid("Elige el tipo de servicio"),
  course: optionalText(120),
  professor: optionalText(120),
  section: optionalText(40),
  academicTerm: optionalText(20),
  description: z.string().trim().min(3, "Describe lo que pide el cliente").max(2000),
  dueDate: optionalDay,
  urgency: z.enum(URGENCIES),
  price: optionalMoney,
  responsableId: optionalUuid,
  status: z.enum(JOB_STATUSES),
  parentJobId: optionalUuid,
});

export type JobInput = z.input<typeof jobSchema>;
export type JobData = z.output<typeof jobSchema>;

/** Al crear: el empleado confirma que es un pedido nuevo (RF-37). */
export const createJobSchema = jobSchema.extend({ confirmedNew: z.boolean().optional() });
export type CreateJobInput = z.input<typeof createJobSchema>;

/** Al editar no se cambia el cliente ni la relación. */
export const updateJobSchema = jobSchema.omit({ clientId: true, parentJobId: true, status: true }).extend({ id: z.uuid() });
export type UpdateJobInput = z.input<typeof updateJobSchema>;

export const statusSchema = z.object({ jobId: z.uuid(), status: z.enum(JOB_STATUSES) });

export const noteSchema = z.object({
  jobId: z.uuid(),
  body: z.string().trim().min(1, "Escribe la nota").max(4000),
});
