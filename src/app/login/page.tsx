import type { Metadata } from "next";
import { signIn } from "@/auth";
import { Mark } from "@/components/brand/mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { STUDIO_NAME } from "@/lib/studio";

export const metadata: Metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  AccessDenied: "Tu correo no está autorizado. Pide acceso a un administrador del estudio.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? "No se pudo iniciar sesión. Inténtalo otra vez.") : null;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden="true" className="drafting-grid absolute inset-0 opacity-60" />
      <ThemeToggle className="absolute top-4 right-4" />

      {/* Tarjeta con cajetín, como la esquina de una lámina de plano. */}
      <div className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-300 ease-(--ease-out) rounded-lg border bg-card">
        <div className="grid gap-6 p-8">
          <Mark draw className="size-10" />
          <div>
            <h1 className="text-2xl font-medium">{STUDIO_NAME}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Clientes, trabajos, pagos y entregas del estudio. Acceso solo para el equipo.</p>
          </div>
          {message && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {message}
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Entrar con Google
            </Button>
          </form>
        </div>
        <dl className="grid grid-cols-2 border-t font-mono text-[11px] text-muted-foreground">
          <div className="border-r px-4 py-3">
            <dt>Lámina</dt>
            <dd className="text-foreground">00 · Acceso</dd>
          </div>
          <div className="px-4 py-3">
            <dt>Uso</dt>
            <dd className="text-foreground">Interno</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
