"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addAllowedEmail, changeRole, removeAllowedEmail } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { ConfirmButton } from "@/components/jobs/job-panels";

export function AddUserForm() {
  const [state, action, pending] = useActionState(addAllowedEmail, null);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <Input name="email" type="email" required placeholder="correo@gmail.com" className="max-w-xs" aria-label="Correo" />
      <NativeSelect name="role" defaultValue="empleado" className="w-auto" aria-label="Rol">
        <option value="empleado">Empleado</option>
        <option value="admin">Administrador</option>
      </NativeSelect>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Dar acceso"}
      </Button>
      {state && !state.ok && (
        <div className="basis-full">
          <FormError message={state.error} />
        </div>
      )}
    </form>
  );
}

/** RF-04: el servidor impide dejar el sistema sin administrador. */
export function RoleSelect({ email, role }: { email: string; role: "admin" | "empleado" }) {
  const [value, setValue] = useState(role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="grid gap-1">
      <NativeSelect
        aria-label={`Rol de ${email}`}
        className="h-10 w-auto sm:h-8"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as "admin" | "empleado";
          setValue(next);
          startTransition(async () => {
            const res = await changeRole(email, next);
            if (!res.ok) {
              setValue(role);
              setError(res.error);
            } else setError(null);
          });
        }}
      >
        <option value="empleado">Empleado</option>
        <option value="admin">Administrador</option>
      </NativeSelect>
      {error && <span className="max-w-xs text-xs text-danger">{error}</span>}
    </span>
  );
}

export function RemoveUserButton({ email }: { email: string }) {
  return (
    <ConfirmButton
      label=""
      icon={<Trash2 />}
      title={`¿Quitar el acceso a ${email}?`}
      description="Ya no podrá entrar. Lo que registró se conserva."
      confirmLabel="Quitar acceso"
      action={() => removeAllowedEmail(email)}
    />
  );
}
