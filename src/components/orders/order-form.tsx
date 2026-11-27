"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { createOrder } from "@/actions/orders";
import { createOrderSchema, type CreateOrderInput } from "@/lib/validation/orders";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive animate-in fade-in">{message}</p> : null;
}

export function OrderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      notes: "",
      dueAt: "",
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });
  const { register, control, handleSubmit, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((acc, i) => acc + Number(i?.quantity || 0) * Number(i?.unitPrice || 0), 0);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const res = await createOrder(values);
      if (res.ok) router.push("/pedidos");
      else setServerError(res.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="customerName">Nombre</Label>
              <Input id="customerName" aria-invalid={!!errors.customerName} {...register("customerName")} />
              <FieldError message={errors.customerName?.message} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input id="customerPhone" type="tel" {...register("customerPhone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueAt">Fecha de entrega</Label>
              <Input id="dueAt" type="datetime-local" {...register("dueAt")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Líneas del pedido</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[5rem_1fr_auto] items-start gap-2 sm:grid-cols-[1fr_5rem_7rem_auto] animate-in fade-in slide-in-from-top-1 duration-200 ease-(--ease-out)">
                <div className="col-span-3 grid gap-1 sm:col-span-1">
                  <Input placeholder="Descripción" aria-label="Descripción" aria-invalid={!!errors.items?.[index]?.description} {...register(`items.${index}.description`)} />
                  <FieldError message={errors.items?.[index]?.description?.message} />
                </div>
                <Input type="number" min={1} aria-label="Cantidad" {...register(`items.${index}.quantity`)} />
                <Input type="number" min={0} step="0.01" aria-label="Precio unitario" {...register(`items.${index}.unitPrice`)} />
                <Button type="button" variant="ghost" size="icon" aria-label="Quitar línea" disabled={fields.length === 1} onClick={() => remove(index)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <FieldError message={errors.items?.root?.message ?? errors.items?.message} />
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
              <Plus /> Añadir línea
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-10">
        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
          {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Guardar pedido"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
