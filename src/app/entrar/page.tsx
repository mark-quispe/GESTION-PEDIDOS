import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowRight, CircleAlert } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { demoEnabled, devLoginEnabled, googleEnabled, SIN_ACCESO_COOKIE } from "@/auth";
import { enterDemo, enterDev, enterWithGoogle } from "@/actions/session";
import { BrandTile } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { EntryPlan } from "@/components/entry/entry-plan";
import { GoogleLogo, SOCIAL_LABEL, SocialIcon, socialHref, type SocialKey } from "@/components/entry/socials";
import { getSettings } from "@/lib/settings";
import { rolesLabel } from "@/lib/domain";
import { todayLima } from "@/lib/dates";

export const metadata: Metadata = { title: "Entrar" };

/** RF-52: página de entrada. RF-02: pantalla «sin acceso». */
export default async function EntryPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const noAccessEmail = error === "sin-acceso" ? (await cookies()).get(SIN_ACCESO_COOKIE)?.value || "Tu correo" : null;
  const s = await getSettings();
  const socials = (["instagram", "tiktok", "facebook", "whatsapp"] as SocialKey[]).filter((k) => s[k]);
  const devUsers = devLoginEnabled ? await db.select().from(users).where(eq(users.active, true)).orderBy(asc(users.createdAt)) : [];
  const [y, m, d] = todayLima().split("-");

  return (
    <div className="sheet-grid relative min-h-dvh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-3 border md:inset-5" />
      <div className="absolute top-6 right-6 z-10 md:top-10 md:right-12">
        <ThemeToggle className="bg-surface" />
      </div>

      <main className="relative mx-auto grid min-h-dvh max-w-[1400px] items-center gap-10 px-7 py-20 md:px-16 lg:grid-cols-[560px_minmax(0,1fr)] lg:px-20">
        <div className="flex max-w-[520px] flex-col gap-7">
          <div className="enter-up">
            <BrandTile name={s.studioName} size={40} />
          </div>
          <div className="flex flex-col gap-3">
            <p className="enter-up font-mono text-xs tracking-[0.06em] text-muted" style={{ "--i": 1 } as React.CSSProperties}>
              LÁMINA 00 · ENTRADA
            </p>
            <h1 className="enter-up text-[40px] leading-[1.05] font-medium tracking-[-0.03em] md:text-[50px]" style={{ "--i": 1 } as React.CSSProperties}>
              Todo el taller en un solo lugar.
            </h1>
            <p className="enter-up text-[17px] leading-relaxed text-muted" style={{ "--i": 2 } as React.CSSProperties}>
              Clientes, trabajos, archivos en Drive y cobros. Hecho para el equipo del estudio.
            </p>
          </div>

          <div className="enter-up flex flex-col gap-4" style={{ "--i": 3 } as React.CSSProperties}>
            {noAccessEmail && (
              <div role="alert" className="flex gap-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-fg-2">
                  <span className="font-medium text-fg">{noAccessEmail}</span> no tiene acceso. Pídele al administrador del estudio que te agregue en Usuarios, o entra con otra cuenta.
                </p>
              </div>
            )}
            {error === "demo" && <p className="text-sm text-danger">La demo no está disponible ahora.</p>}
            {error && error !== "sin-acceso" && error !== "demo" && <p className="text-sm text-danger">No se pudo entrar. Inténtalo de nuevo.</p>}
            <div className="flex flex-wrap gap-3">
              {googleEnabled ? (
                <form action={enterWithGoogle}>
                  <button type="submit" className="press inline-flex h-12 items-center gap-2.5 rounded-md bg-primary px-[22px] text-[15px] font-medium text-on-primary hover-fine:hover:opacity-90">
                    <GoogleLogo />
                    {noAccessEmail ? "Usar otra cuenta" : "Entrar con Google"}
                  </button>
                </form>
              ) : (
                <span className="inline-flex h-12 items-center gap-2.5 rounded-md border border-dashed px-5 text-[13px] text-muted" title="Falta AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET">
                  <GoogleLogo /> Google sin configurar
                </span>
              )}
              {demoEnabled && (
                <form action={enterDemo}>
                  <button
                    type="submit"
                    className="press group inline-flex h-12 items-center gap-2.5 rounded-md border bg-surface px-5 text-[15px] font-medium hover-fine:hover:border-border-strong hover-fine:hover:bg-hover"
                  >
                    Ver la demo
                    <ArrowRight className="size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-[3px]" strokeWidth={1.8} />
                  </button>
                </form>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              Entran solo los correos que el administrador agregó.
              <br />
              La demo abre la vista de administrador con datos de ejemplo y no guarda nada.
            </p>
          </div>

          {devUsers.length > 0 && (
            <form action={enterDev} className="enter-up flex flex-col gap-2 rounded-lg border border-dashed p-3" style={{ "--i": 4 } as React.CSSProperties}>
              <p className="font-mono text-[11px] text-muted">ACCESO DE PRUEBA · solo en desarrollo</p>
              <div className="flex flex-wrap gap-2">
                {devUsers.map((u) => (
                  <button key={u.id} name="email" value={u.email} type="submit" className="press inline-flex h-9 items-center gap-2 rounded-md border bg-surface px-3 text-[13px] hover-fine:hover:border-border-strong">
                    {u.name}
                    <span className="font-mono text-[11px] text-muted">{rolesLabel(u.roles)}</span>
                  </button>
                ))}
              </div>
            </form>
          )}
        </div>

        <div className="enter-up hidden flex-col gap-6 lg:flex" style={{ "--i": 2 } as React.CSSProperties}>
          <EntryPlan className="block w-full" />
          <div className="flex items-end justify-between gap-6">
            {socials.length > 0 ? (
              <div>
                <p className="mb-2 font-mono text-[11px] tracking-[0.06em] text-faint">REDES DEL ESTUDIO</p>
                <div className="flex gap-2">
                  {socials.map((k) => (
                    <a
                      key={k}
                      href={socialHref(k, s[k]!)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={SOCIAL_LABEL[k]}
                      className="press grid size-10 place-items-center rounded-md border text-muted transition-colors duration-150 hover-fine:hover:border-border-strong hover-fine:hover:text-fg"
                    >
                      <SocialIcon name={k} />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <span />
            )}
            <dl className="grid grid-cols-3 border bg-side text-[11px]">
              {[
                ["PROYECTO", "Gestión de pedidos"],
                ["LÁMINA", "00 · Entrada"],
                ["ESCALA", "1:50"],
                ["USO", "Interno"],
                ["FECHA", `${d}·${m}·${y}`],
                ["VERSIÓN", "v1"],
              ].map(([k, v], i) => (
                <div key={k} className={`px-3 py-2 ${i % 3 ? "border-l" : ""} ${i >= 3 ? "border-t" : ""}`}>
                  <dt className="font-mono text-[10px] tracking-[0.06em] text-faint">{k}</dt>
                  <dd className="mt-0.5 whitespace-nowrap">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {socials.length > 0 && (
          <div className="flex gap-2 lg:hidden">
            {socials.map((k) => (
              <a key={k} href={socialHref(k, s[k]!)} target="_blank" rel="noreferrer" aria-label={SOCIAL_LABEL[k]} className="press grid size-11 place-items-center rounded-md border text-muted">
                <SocialIcon name={k} />
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
