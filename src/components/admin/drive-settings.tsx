"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectDrive, setDriveRoot } from "@/actions/drive";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { GooglePickerButton } from "./google-picker";

export function ChooseRootFolder({ hasRoot }: { hasRoot: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <GooglePickerButton
        kind="folder"
        variant={hasRoot ? "outline" : "default"}
        label={pending ? "Guardando…" : hasRoot ? "Cambiar carpeta" : "Elegir la carpeta del negocio"}
        title="Elige la carpeta del negocio"
        onPicked={(doc) =>
          startTransition(async () => {
            const res = await setDriveRoot(doc.id);
            setError(res.ok ? null : res.error);
            router.refresh();
          })
        }
      />
      <FormError message={error} />
    </div>
  );
}

export function DisconnectDrive() {
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => void (await disconnectDrive()))}>
      Desconectar
    </Button>
  );
}
