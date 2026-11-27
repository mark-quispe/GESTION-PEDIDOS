# Gestión de pedidos

Aplicación web **de uso interno** para un estudio que hace trabajos de arquitectura para universitarios: clientes, cotizaciones, avance de cada trabajo, pagos y entregas. No es una tienda: los estudiantes nunca entran. Solo entran los correos autorizados, con rol **administrador** o **empleado**.

## Requerimientos

Las reglas del sistema están en [`docs/requerimientos.md`](docs/requerimientos.md). Es la fuente de verdad: ante cualquier duda, manda ese documento. El código cita el requisito que cumple (`RF-xx`, `RNF-xx`).

## Qué hace (versión 1: RF-01 a RF-46)

| Pantalla | Para qué |
| --- | --- |
| **Inicio** (`/`) | Entregas de hoy y mañana, atrasados, cotizaciones sin respuesta y saldos por cobrar. El admin ve además pagos de hoy e ingresos del mes con gráfico (RF-19, RF-20). |
| **Trabajos** (`/trabajos`) | Lista con filtros por estado, responsable, fecha y urgencia, o **tablero** con una columna por estado (RF-11, RF-12). Atrasados marcados solos (RF-13). |
| **Nuevo trabajo** | Código automático `PL26-014` (RF-08). Avisos de mismo curso (RF-35), pedido repetido (RF-37) y deuda anterior (RF-46). Trabajos relacionados siempre al original (RF-39). |
| **Ficha del trabajo** | Estado (cuenta correcciones, RF-10), pagos con saldo y estado de pago (RF-14 a RF-17), devoluciones (RF-42), capturas (RF-43), archivos en Drive (RF-24, RF-25), notas internas (RF-44), relacionados con total del grupo, historial (RF-21). |
| **Clientes** | Búsqueda por nombre o número (RF-06), WhatsApp único (RF-36), preferencias y "Nuevo trabajo para este cliente" (RF-38), observaciones (RF-45), historial de trabajos y pagos (RF-07). |
| **Carga** (`/carga`) | Trabajos en curso por responsable y semana, sin montos (RF-41). |
| **Pagos** (`/pagos`, admin) | Pagos del día o de la semana por medio, para cuadrar con Yape o el banco (RF-15). |
| **Administración** | Usuarios (nunca sin admin, RF-04), responsables (RF-18), tipos de servicio y prefijos, Drive y correlativo, datos (exportar, importar, respaldos y contingencia), eliminados con restauración (RF-29) e historial de cambios (RF-21). |

Permisos: la tabla de la sección 2.1 del documento se valida **en el servidor** en cada página y Server Action (`src/lib/auth-guard.ts`, RNF-04). `src/proxy.ts` solo manda a `/login` a quien no tiene sesión.

## Stack

Next.js 16 (App Router, Server Actions) · PostgreSQL en Neon + Drizzle · Auth.js con Google · Zod + react-hook-form · Tailwind + componentes shadcn/ui · TanStack Table · Recharts · Google Drive API + Picker · ExcelJS · Vercel (cron diario) · PWA.

## Puesta en marcha

### En local (sin instalar nada más)

1. `pnpm install`
2. Crea `.env.local` con una sola línea: `AUTH_SECRET="..."` (`npx auth secret` la genera).
3. `pnpm dev` y entra en http://localhost:3000

Sin `DATABASE_URL`, la app usa **PGlite**: un Postgres que corre dentro de Node y guarda los datos en `.pglite/`. La primera vez crea las tablas, carga el **tarifario** (15 categorías y 98 ítems) y un **estudio ficticio** con fechas relativas a hoy. En desarrollo, la página de entrada muestra un **acceso de prueba** para entrar como Mark (admin), Ana (empleado + producción), Luis (producción) o Carla (empleado) sin Google. `pnpm db:reset` borra la base local y la vuelve a crear.

### Con Neon y Google

1. Copia `.env.example` a `.env.local` **y** a `.env` (drizzle-kit lee `.env`) y rellena los valores.
2. Crea las tablas en la rama `dev` de Neon: `pnpm db:migrate`
3. Pon tu correo en `ADMIN_EMAIL`: la primera vez que la app arranca contra una base vacía lo crea como administrador.
4. Como admin: conecta **Drive** (Configuración) y revisa el tarifario (Servicios).

### Google Cloud (un solo proyecto para login y Drive)

1. Pantalla de consentimiento OAuth: tipo **Externo** y **publicada "En producción"** (RNF-10; en "Prueba" la conexión con Drive caduca cada 7 días). `drive.file` no requiere verificación.
2. Activa **Google Drive API** y **Google Picker API**.
3. Credencial **ID de cliente OAuth (aplicación web)** con estas URI de redirección (local y producción):
   - `https://TU-DOMINIO/api/auth/callback/google` (login)
   - `https://TU-DOMINIO/api/drive/callback` (conectar Drive)
   - Orígenes de JavaScript autorizados: `https://TU-DOMINIO` (lo pide el Picker).
4. Una **clave de API** restringida a Picker API y a tu dominio → `NEXT_PUBLIC_GOOGLE_API_KEY`.
5. El **número del proyecto** (Configuración del proyecto) → `NEXT_PUBLIC_GOOGLE_APP_ID`.

El login solo pide nombre y correo. El permiso de Drive es aparte: lo da el admin una vez con "Conectar Drive" y luego elige la carpeta del negocio con el Picker (RF-22). La llave se guarda cifrada con `DRIVE_ENCRYPTION_KEY`.

## Base de datos (Neon)

- Ramas: `dev` para programar y `main` para producción. Motor fijo en **0.25 CU** (mínimo y máximo, RNF-12). Ninguna pantalla se recarga sola.
- Esquema en `src/db/schema.ts`; migraciones en `drizzle/`. Tras cambiar el esquema: `pnpm db:generate`, probar con `pnpm db:migrate` en `dev`, y después en `main` (sección 6).
- El correlativo de códigos vive en `job_counters` y se incrementa con una sola sentencia atómica.
- Nada se borra de verdad: clientes, trabajos y pagos tienen `deleted_at`.

## Despliegue en Vercel

1. Importa el repo. Cada push a `main` publica; trabaja siempre en ramas y revisa el preview antes de unir (sección 6).
2. Variables de entorno: las de `.env.example`, con la `DATABASE_URL` de la rama `main` de Neon. `CRON_SECRET` la usa Vercel para llamar al respaldo.
3. `vercel.json` programa el respaldo diario (`/api/cron/respaldo`, 03:00 hora de Perú): un Google Sheets por día en "Respaldos" (se guardan 30) y la planilla de contingencia actualizada (RF-32, RF-33).

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `typecheck` | ESLint y TypeScript |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |
| `pnpm db:reset` | Borra y vuelve a crear la base local con datos de prueba |

## Decisiones tomadas donde el documento deja margen

- **Precio:** el empleado puede poner el primer precio (cotizar) al crear el trabajo o mientras está vacío; cambiarlo después o dar descuento es solo del admin (tabla 2.1).
- **Correcciones:** se cuentan solas cada vez que el trabajo pasa a "Correcciones".
- **Urgencia:** Normal, Alta, Urgente.
- **Preferencias del cliente** (software, versión, formato): el trabajo no tiene esos campos, así que se copian como primera línea de la descripción, y el responsable preferido se elige solo.
- **Aviso de mismo curso (RF-35):** compara curso y universidad del cliente, y además profesor y ciclo cuando están llenos en ambos trabajos. Excluye los trabajos del mismo cliente (esos los cubre RF-37).
- **Importar (RF-28):** se omiten las filas con errores y se importa el resto; un mismo archivo no se puede importar dos veces. La carga inicial no crea carpetas en Drive (se crean desde la ficha); la contingencia sí (RF-34).
- **Borrar archivos:** van a la papelera de Drive (30 días para recuperarlos).
- **Usuarios (RF-04):** la tabla «Qué puede cada rol» sigue la tabla 2.1 v0.9 (Producción = Empleado + Tomar), no la del artboard. Admin incluye todo y se guarda solo; el último admin no se puede quitar.
- **Producción (RF-18):** el interruptor Activo solo cambia a los externos; el acceso de alguien del estudio se cambia en Usuarios. Las etiquetas de cada persona del estudio son las categorías que más horas hizo (no se le pone «qué hace»).
- **Servicios:** las casillas con flechas se guardan solas al dejar de moverlas (0,7 s) y cada cambio queda en el Historial. Cambiar el tarifario no toca los trabajos ya registrados.
- **Importar (RF-28):** la columna «Ítems» acepta códigos del tarifario («PL-02 x2, PL-06»). Sin ítems, la fila entra como Personalizado con su descripción y precio.
- **Respaldo:** la hora (03:00) la fija el cron de Vercel; en Configuración se puede pausar, no cambiar la hora. El aviso de Drive lleno se mide en GB.
- **Finalizar (pedido de Mark, 27/11):** un trabajo no pasa a Finalizado si le falta cobrar algo. El botón queda desactivado y el servidor lo rechaza. El documento de requerimientos (sección «sin reglas en la v1») debe actualizarse con esta regla.
- **Correcciones (pedido de Mark, 27/11):** el empleado también registra y hace correcciones. En la ventana de corrección puede elegir «Yo la tomo» aunque no tenga el rol Producción, y luego marca «Corrección hecha». Tomar trabajos nuevos del pozo sigue siendo solo de Producción y del admin.
- **Logo del estudio:** se guarda como imagen pequeña (máx. 150 KB) en la base, sin depender de Drive.

## Pendientes con el dueño (sección 9 del documento)

Lista inicial de tipos de servicio y prefijos, si el correlativo empieza en 1 o en 100 (Configuración), datos actuales a importar, y con qué Gmail se conecta Drive.

## Notas de diseño

Dark Minimalist en grises (#121212 #1d1d1d #292929 #363636 #a3a3a3 #ededed), color solo para estados (`--danger`, `--warning`, `--success`, `--info`). Claro, oscuro o sistema. Work Sans + Geist Mono, marca de puerta batiente en planta, nombre del estudio en `NEXT_PUBLIC_STUDIO_NAME`.
