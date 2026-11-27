"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { restoreClient } from "@/actions/clients";
import { restoreJob } from "@/actions/jobs";
import { restorePayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";

const ACTIONS = { cliente: restoreClient, trabajo: restoreJob, pago: restorePayment };

export function RestoreButton({ kind, id }: { kind: keyof typeof ACTIONS; id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-grid justify-items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await ACTIONS[kind](id);
            setError(res.ok ? null : res.error);
          })
        }
      >
        <RotateCcw /> {pending ? "Restaurando…" : "Restaurar"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
