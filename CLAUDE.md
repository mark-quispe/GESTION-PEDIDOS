# Instrucciones para agentes

@AGENTS.md

## Fuente de verdad

`docs/requerimientos.md` es el documento de requerimientos acordado con el estudio. **Ante cualquier duda manda ese documento**: reglas de negocio, estados, códigos de trabajo, pagos, permisos, Drive, respaldos y requisitos no funcionales. Si el código y el documento no coinciden, el código está mal (o hay que pedir que se actualice el documento, nunca asumir).

## Reglas de trabajo

- Nunca hacer push directo a `main`: rama + pull request.
- Ramas de Neon: `dev` para desarrollo y `main` para producción.
- Diseño: Dark Minimalist en grises (#121212 #1d1d1d #292929 #363636 #a3a3a3 #ededed); el color solo comunica estados. Modo claro, oscuro y sistema.
- Moneda PEN y formatos de Perú (`es-PE`).
- Validar el rol en cada Server Action (`assertRole`), no solo en la interfaz.
- Todo cambio de estado, precio o pago va con su registro en `audit_log` dentro del mismo `db.batch` (`src/lib/audit.ts`).
- Nada se borra de verdad: clientes, trabajos y pagos usan `deletedAt`.
- Ninguna pantalla se actualiza sola (RNF-12: horas de cómputo de Neon).
- Las decisiones tomadas donde el documento deja margen están en el README; si el documento cambia, revisarlas.
