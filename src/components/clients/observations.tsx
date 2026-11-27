"use client";

import { useState, useTransition } from "react";
import { saveObservations } from "@/actions/clients";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";

/** RF-45: texto libre visible para los dos roles. */
export function Observations({ clientId, initial }: { clientId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Textarea aria-label="Observaciones" rows={3} placeholder="“Paga tarde”, “pide muchas correcciones”…" value={value} onChange={(e) => setValue(e.target.value)} />
      <FormError message={error} />
      {value !== saved && (
        <Button
          size="sm"
          variant="outline"
          className="justify-self-end animate-in fade-in"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveObservations(clientId, value);
              if (!res.ok) return setError(res.error);
              setSaved(value);
              setError(null);
            })
          }
        >
          {pending ? "Guardando…" : "Guardar observaciones"}
        </Button>
      )}
    </div>
  );
}
