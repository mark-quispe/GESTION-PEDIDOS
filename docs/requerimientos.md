# Documento de requerimientos: sistema de gestión de pedidos

| | |
|---|---|
| **Cliente** | Estudio de arquitectura (trabajos para universitarios) |
| **Versión del documento** | 0.5 (borrador) |
| **Fecha** | 21/11/2026 |
| **Estado** | En Proceso |

---

## 1. Descripción general

Aplicación web **de uso interno** para un estudio que hace trabajos de arquitectura para estudiantes universitarios. Sirve para registrar clientes, cotizar, seguir el avance de cada trabajo, controlar los pagos y ver las entregas próximas.

**No es** una tienda ni un portal para clientes: los estudiantes nunca entran al sistema.

---

## 2. Usuarios y roles

| Rol | Quién es | Para qué usa el sistema |
|---|---|---|
| **Administrador** | El dueño del estudio | Supervisar todo, controlar el dinero y tomar decisiones |
| **Empleado** | Un gestor que nombra el dueño | Atender pedidos, registrar datos y hacer seguimiento |

Los **responsables** son las personas que hacen los trabajos, ya sea el dueño o un colaborador externo. **No tienen cuenta**: son solo nombres en una lista.

### 2.1 Permisos

| Acción | Admin | Empleado |
|---|:-:|:-:|
| Registrar y editar clientes | ✅ | ✅ |
| Crear trabajos y cambiar su estado | ✅ | ✅ |
| Cambiar precios o dar descuentos | ✅ | ❌ |
| Registrar pagos recibidos | ✅ | ✅ |
| Revisar pagos del día o de la semana | ✅ | ❌ |
| Corregir o anular un pago ya registrado | ✅ | ❌ |
| Registrar devoluciones | ✅ | ❌ |
| Asignar responsables | ✅ | ✅ |
| Ver la carga por responsable (sin montos) | ✅ | ✅ |
| Escribir notas internas y observaciones del cliente | ✅ | ✅ |
| Gestionar la lista de responsables | ✅ | ❌ |
| Ver ganancias y pagos a colaboradores | ✅ | ❌ |
| Cancelar trabajos | ✅ | ✅ |
| Eliminar y restaurar registros | ✅ | ❌ |
| Gestionar usuarios y accesos | ✅ | ❌ |
| Ver el historial de cambios | ✅ | ❌ |
| Subir y ver archivos de un trabajo | ✅ | ✅ |
| Borrar archivos | ✅ | ❌ |
| Conectar o cambiar el Drive | ✅ | ❌ |
| Exportar datos | ✅ | ❌ |
| Importar datos | ✅ | ❌ |

---

## 3. Requerimientos funcionales

### 3.1 Acceso

- **RF-01** Inicio de sesión con cuenta de Google. Al entrar, el sistema solo pide el nombre y el correo del usuario; el permiso de Drive es aparte y solo lo da el admin (RF-22).
- **RF-02** Solo pueden entrar los correos que el admin autorizó. Cualquier otro correo recibe acceso denegado.
- **RF-03** Cada usuario ve solo las pantallas y acciones de su rol.
- **RF-04** El admin puede dar acceso a un usuario, quitárselo y cambiarle el rol. El sistema **no permite quitar el rol ni el acceso al último admin**, para que nunca quede sin administrador.

### 3.2 manejo de los Clientes osea la data 

- **RF-05** Registrar al cliente con nombre, WhatsApp, universidad, carrera, ciclo y cómo llegó.
- **RF-06** Buscar clientes por nombre o por número.
- **RF-07** Ver el historial de un cliente: sus trabajos y lo que ha pagado.
- **RF-36** **No puede haber dos clientes con el mismo WhatsApp.** Si el empleado escribe un número que ya existe, el sistema no crea otro cliente: muestra el que ya está registrado y lo usa.
- **RF-38** **Preferencias del cliente.** En su ficha se guardan el software y la versión que usa, su formato habitual y el responsable con el que suele trabajar. Desde la ficha, el botón **"Nuevo trabajo para este cliente"** abre el formulario con esas preferencias ya completadas. Lo propio de cada pedido (curso, profesor, fechas, precio) siempre se llena de nuevo.
- **RF-45** **Observaciones del cliente:** texto libre en su ficha ("paga tarde", "pide muchas correcciones"…), visible para los dos roles.

### 3.3 Trabajos

- **RF-08** Cada trabajo recibe un **código automático** que lo identifica en el sistema, en Drive y al hablar con el cliente. Formato: **prefijo del tipo de servicio + año + número**.

  | Ejemplo | Significado |
  |---|---|
  | `PL26-014` | Planos, 2026, trabajo 14 |
  | `RD26-015` | Render, 2026, trabajo 15 |
  | `MQ26-016` | Maqueta, 2026, trabajo 16 |

  - El número es un **correlativo único por año** (compartido por todos los tipos) y se reinicia cada enero. Puede empezar en 100 para no revelar el volumen del negocio.
  - Cada tipo de servicio tiene un prefijo de dos letras, que el admin define.
  - El código **no cambia** después de creado, aunque luego se edite el tipo de servicio.
  - Es solo una etiqueta: internamente, la base de datos usa su propio ID técnico.

  El trabajo se registra con estos datos: cliente, tipo de servicio, curso, profesor, sección y ciclo académico (por ejemplo 2026-II) **(estos tres últimos opcionales: muchos clientes no los dan)**, descripción de lo que pide, fecha de entrega (el día en que el cliente quiere recibir el trabajo), urgencia, precio y responsable.
- **RF-09** Cambiar el estado siguiendo este flujo:

  | Estado | Qué significa |
  |---|---|
  | Consulta | Escribió, todavía no hay precio |
  | Cotizado | Se le dio el precio y falta que confirme |
  | Confirmado | Pagó el adelanto y el trabajo empieza |
  | En proceso | Alguien lo está haciendo |
  | En revisión | Se le envió el avance o el trabajo final al estudiante |
  | Correcciones | Pidió cambios |
  | Entregado | Recibió la versión final |
  | Cancelado | No confirmó o se echó atrás (posible desde cualquier estado) |

- **RF-10** Contar las correcciones hechas en cada trabajo.
- **RF-11** Filtrar los trabajos por estado, responsable, fecha y urgencia.
- **RF-12** Ver los trabajos en un tablero, con una columna por estado.
- **RF-13** Marcar automáticamente como **atrasado** todo trabajo cuya fecha de entrega ya pasó sin entregarse.

#### Pedidos repetidos y parecidos

- **RF-35** **Aviso de trabajos del mismo curso.** Al registrar un trabajo, si ya hay otros del mismo **curso, universidad, profesor y ciclo**, el sistema muestra un aviso con esos trabajos y su responsable, para que cada uno salga diferente. Es solo un aviso: no impide guardar. No avisa por los trabajos relacionados del mismo cliente (RF-39).
  - Como profesor, sección y ciclo son opcionales, el aviso compara **solo los datos que estén llenos**. Si únicamente hay curso y universidad, avisa igual, pero como *"posible coincidencia"*, porque es menos seguro.
- **RF-37** **Confirmación de pedido repetido.** Si el cliente ya tiene un trabajo abierto del mismo curso o tipo de servicio, el sistema pregunta: *"Este cliente ya tiene abierto PL26-014. ¿Es un pedido nuevo o es el mismo?"* Si es nuevo, lo crea; si es el mismo, lleva al trabajo existente.
- **RF-46** **Aviso de deuda anterior.** Al crear un trabajo para un cliente con saldo pendiente, el sistema muestra lo que debe y de qué trabajo. Es solo un aviso.

#### Trabajos relacionados

- **RF-39** Al crear un trabajo se puede indicar que está **relacionado con un trabajo anterior del mismo cliente**, por ejemplo un avance siguiente o algo nuevo que pidió el profesor. Cada trabajo relacionado tiene su propio código, precio, fecha, estado y pagos.
  - La relación **siempre apunta al trabajo original**, nunca al último, para no formar cadenas.
  - Si el empleado elige por error un trabajo que ya es relacionado, el sistema lo corrige solo y conecta el nuevo al **original de ese trabajo**.
  - Solo se puede relacionar con trabajos del mismo cliente.
  - Desde el trabajo original se ve la lista de sus relacionados, con el total cobrado y el saldo de todo el grupo.
- **RF-40** La carpeta de Drive de un trabajo relacionado se crea **dentro de la carpeta del trabajo original**, para que los archivos de todo el proyecto queden juntos.

#### Seguimiento

- **RF-41** **Carga por responsable.** Vista de trabajos en curso por responsable y por semana, con sus fechas de entrega y sin montos, para repartir la carga antes de asignar un trabajo nuevo.
- **RF-44** **Notas internas por trabajo:** un resumen de lo conversado con el cliente, con fecha y autor. Las notas nuevas se suman a las anteriores, como una bitácora.

### 3.4 Pagos

- **RF-14** Registrar cada pago con monto, fecha, medio (Yape, Plin, transferencia o efectivo) y número de operación.
- **RF-15** Los pagos se registran como confirmados al momento. El admin tiene una vista de **pagos del día** o de la semana para compararlos con su app de Yape o del banco y, si encuentra un error, lo corrige. Esa corrección queda en el historial (RF-21).
- **RF-16** Calcular automáticamente el saldo pendiente de cada trabajo, con los pagos registrados.
- **RF-17** Mostrar el estado de pago de cada trabajo, separado del estado del trabajo: Sin pagar → Adelanto pagado → Pagado completo.
- **RF-42** **Devoluciones.** Solo el admin puede registrar una devolución (monto, fecha, medio y motivo), por ejemplo si un cliente cancela después de pagar el adelanto. Se descuenta de lo pagado y queda en el historial.
- **RF-43** **Captura del comprobante.** Al registrar un pago se puede adjuntar, de forma opcional, la imagen del Yape o la transferencia. Se guarda en la subcarpeta **"Pagos"** del trabajo en Drive (se crea al subir la primera captura) y queda enlazada a ese pago.

### 3.5 Responsables

- **RF-18** El admin mantiene la lista de responsables: nombre, contacto y si está activo o no.

### 3.6 Pantalla principal

- **RF-19** Para los dos roles muestra: entregas de hoy y de mañana, trabajos atrasados, cotizaciones sin respuesta y saldos por cobrar.
- **RF-20** Para el admin muestra además: pagos de hoy e ingresos del mes.

### 3.7 Historial y eliminación

- **RF-21** Registrar quién cambió qué y cuándo en los estados, los precios y los pagos. Cada pago muestra quién lo registró y, si fue corregido, el valor anterior y el nuevo.
- **RF-29** **Nada se borra de verdad.** Al eliminar un cliente, trabajo o pago, el registro se marca como eliminado y se oculta. El admin tiene una vista de eliminados desde donde puede **restaurarlos**.

### 3.8 Archivos (Google Drive)

- **RF-22** El admin conecta su Google Drive desde la configuración, **una sola vez**, con el botón "Conectar Drive":
  - Google le muestra la pantalla de permiso y él acepta.
  - El sistema guarda la llave de acceso (refresh token) **cifrada** en la base de datos.
  - Se abre el selector de Google (**Google Picker**) y el admin elige la carpeta del negocio que ya existe en su Drive. Esto se hace **una sola vez**: al elegirla, la app recibe permiso sobre esa carpeta.
  - El sistema guarda el ID de esa carpeta como **raíz**. Desde ahí, todo lo que crea, sube o mueve (carpetas de trabajos, archivos y la carpeta "Respaldos") queda **dentro de esa carpeta** y en ningún otro lugar del Drive.
  - El empleado no necesita ningún acceso a Drive: todo se guarda en el Drive del admin.
- **RF-23** Al registrar un trabajo, el sistema crea su carpeta **dentro de la raíz**, con el nombre `PL26-014 - Cliente - Descripción corta`, y dentro tres subcarpetas: **Recibido**, **Avances** y **Entrega final**. Guarda en la base de datos el ID de la carpeta y de cada subcarpeta. Como el sistema usa los IDs y no los nombres, si alguien renombra o mueve una carpeta en Drive, no se rompe nada.
- **RF-24** Desde la ficha del trabajo se pueden subir archivos eligiendo la subcarpeta. El archivo se guarda en Drive y el sistema guarda solo su ID, enlace, nombre, tamaño, quién lo subió y cuándo.
- **RF-25** La ficha del trabajo muestra la lista de sus archivos con enlace para abrirlos o descargarlos, y un botón para abrir la carpeta completa en Drive.
- **RF-26** El admin puede **cambiar la cuenta o la carpeta de Drive**: vuelve a elegir una carpeta con el selector y se reemplaza el ID de la raíz en la configuración. Los archivos nuevos se guardan en el destino nuevo; los anteriores se quedan donde estaban y sus enlaces siguen funcionando. Mover los archivos antiguos no lo hace el sistema: se hace a mano en Drive.
- **RF-30** Si la conexión con Drive se pierde (permiso quitado, credenciales cambiadas), el sistema muestra al admin el aviso **"Drive desconectado, vuelve a conectarlo"**, en vez de fallar sin explicación.
- **RF-31** Si la carpeta de un trabajo fue borrada en Drive, el sistema lo detecta y ofrece **volver a crearla**.

### 3.9 Exportar, importar y respaldos

- **RF-27** El admin puede **exportar** clientes, trabajos y pagos, completos o filtrados por fechas, como **Google Sheets** guardado en su Drive. También puede descargarlos como `.xlsx`. Sirve para reportes y para sacar los datos si algún día se deja de usar el sistema.
- **RF-28** El admin puede **importar** clientes y trabajos desde un **Google Sheets** con la plantilla que da el sistema. Elige la hoja con el selector de Google (Google Picker), que es lo que le da a la app permiso para leerla. También acepta un `.xlsx` subido desde la computadora. Sirve para la carga inicial de datos que hoy están fuera del sistema. Antes de guardar, el sistema muestra una vista previa con los errores encontrados.
- **RF-32** **Respaldo automático diario.** Una tarea programada (cron de Vercel, una vez al día) exporta clientes, trabajos y pagos como un **Google Sheets** (una hoja por tabla) y lo guarda en la carpeta **"Respaldos"**, dentro de la carpeta raíz del negocio, con la fecha en el nombre del archivo. Se conservan los últimos 30 días y los más antiguos se borran solos. El respaldo usa **las mismas columnas que la plantilla de importación** (RF-28), para que se pueda abrir y leer desde el navegador, en cualquier computadora (Mac o Windows) o celular, sin instalar nada ni necesitar ayuda técnica.
- **RF-33** El sistema mantiene en la carpeta "Respaldos" **una sola planilla de contingencia** vacía, en **Google Sheets**, lista para usar si el sistema se cae (ver sección 7). Cada día la **actualiza** con el último código usado de cada tipo de servicio, en su primera hoja; no crea una nueva cada día. En caso de caída, se trabaja sobre una copia de ella.
- **RF-34** El admin puede **importar la planilla de contingencia** cuando el sistema vuelve, eligiendo su copia con el selector de Google (Google Picker). Este paso es necesario porque la copia la hizo una persona y no la app, y sin elegirla la app no tiene permiso para leerla (RNF-09). El sistema:
  - Muestra una vista previa con lo que va a crear o cambiar y los errores encontrados.
  - Aplica los registros **en orden de fecha**: clientes nuevos, trabajos nuevos, cambios de estado y pagos.
  - **Respeta los códigos** escritos en la planilla y adelanta el correlativo para que no se repitan.
  - Crea en Drive las carpetas de los trabajos nuevos.
  - Marca en el historial que esos registros vinieron de la contingencia y quién los importó.
  - Rechaza un archivo que ya fue importado, para que nada se duplique.

---

## 4. Reglas de negocio

Hoy el negocio funciona de manera informal y no tiene reglas fijas. Por eso, **en la versión 1 el sistema no impone ninguna regla**: solo registra los datos. El precio, el adelanto y las correcciones se manejan caso por caso, como hasta ahora.

Lo que el sistema sí guarda (adelantos, correcciones y urgencia) le servirá al dueño para decidir más adelante si quiere fijar reglas como estas:

| Posible regla futura | Ejemplo |
|---|---|
| Adelanto mínimo para empezar | 50 % |
| Correcciones incluidas en el precio | 2 |
| Recargo por urgencia (menos de 48 h) | +30 % |
| Pago al colaborador | % o monto fijo según el servicio |

### 4.1 Única regla fija: corrección o trabajo nuevo

Para que el empleado sepa cuándo cobrar:

- **Corrección:** cambios sobre lo que ya se acordó. Se cuenta en RF-10 y **no se cobra aparte**.
- **Trabajo relacionado:** algo **nuevo** que no estaba en el pedido original, como una lámina o presentación extra que agregó el profesor. Se registra como trabajo relacionado (RF-39) y **tiene su propio precio**.

---

## 5. Requerimientos no funcionales

- **RNF-01** El sistema se construye con el stack definido en la sección 5.1.
- **RNF-02** Se publica en Vercel en cada push a `main`. La base de datos tiene una rama de desarrollo y otra de producción.
- **RNF-03** Funciona bien en el celular y se puede instalar como app (PWA).
- **RNF-04** Los permisos se validan en el servidor, no solo en la interfaz.
- **RNF-05** Los archivos se guardan en Google Drive, nunca en la base de datos. La base solo guarda la referencia (ID y enlace del archivo).
- **RNF-06** La moneda es soles (S/), con horario y formato de fecha de Perú.
- **RNF-07** Costo cero: todo funciona dentro de los planes gratuitos.
- **RNF-08** Los archivos se suben **directo del navegador a Drive** (subida reanudable), sin pasar por el servidor. Vercel no acepta envíos de más de 4.5 MB al servidor, y los archivos de arquitectura suelen pesar más.
- **RNF-09** La conexión con Drive usa **OAuth con la cuenta del admin** y el permiso mínimo (`drive.file`): el sistema solo ve los archivos que él mismo creó, no el resto del Drive del dueño. No se usa una cuenta de servicio (*service account*), porque con un Gmail normal no tiene espacio propio y los archivos no quedarían a nombre del dueño.
- **RNF-10** La app de Google Cloud debe estar **publicada en "En producción"**. Si se queda en "Prueba", la conexión con Drive caduca cada 7 días. Como `drive.file` es un permiso no sensible, publicarla no requiere verificación de Google.
- **RNF-11** Límites esperados con los planes gratuitos (aproximados, verificar en cada servicio):

  | Recurso | Límite | Alcance estimado |
  |---|---|---|
  | Usuarios | Sin límite práctico | Decenas de usuarios sin problema |
  | Base de datos (Neon) | ~0.5 GB | Muchos años de trabajos |
  | Archivos (Google Drive) | 15 GB, compartidos con Gmail y Fotos | **Primer límite real**: depende del peso de los archivos |
  | Cron (Vercel Hobby) | 1 ejecución al día | Suficiente para el respaldo diario |
  | Neon en reposo | Se apaga tras ~5 min sin uso | La primera carga tarda 1 a 2 s más; es normal |
  | Vercel Hobby | Solo uso no comercial | Si el sistema se vende, pasar a Pro |

- **RNF-12** ⚠️ **Horas de cómputo de Neon.** El plan gratuito da unas **100 CU-horas al mes**, que con el motor de 0.25 CU equivalen a unas **400 horas encendido**. Las horas se cuentan **por la base de datos, no por usuario**: si varias personas la usan al mismo tiempo, cuenta una sola vez. Si se acaban, la base se detiene hasta el mes siguiente y el sistema se cae. Para evitarlo:
  - **Ninguna pantalla se actualiza sola** cada cierto tiempo. Los datos se actualizan cuando el usuario hace algo o recarga la página, para que una pestaña abierta toda la noche no mantenga la base encendida.
  - El motor de Neon se fija en **0.25 CU** (mínimo y máximo).
  - No se usan monitores de disponibilidad que consulten la base de datos.
  - Meta: **menos de 300 horas encendido al mes**. Con el horario normal del negocio (unas 260 h) se cumple sin problema.
  - El consumo se revisa en el panel "Usage" de Neon, sobre todo el primer mes.

### 5.1 Stack tecnológico

| Capa | Tecnología | Para qué se usa | Plan |
|---|---|---|---|
| **Framework** | **Next.js** (React + TypeScript) | Toda la app: pantallas y servidor en un solo proyecto | Libre |
| **Formularios y acciones** | **Server Actions** de Next.js | Guardar y cambiar datos sin armar una API aparte | Libre |
| **Validación** | **Zod** + **react-hook-form** | Las mismas reglas validan el formulario en pantalla y la Server Action en el servidor | Libre |
| **Base de datos** | **PostgreSQL en Neon** | Clientes, trabajos, pagos, notas e historial. Rama `dev` para programar y rama `main` para producción | Gratuito |
| **ORM** | **Drizzle** | Definir las tablas en TypeScript, hacer consultas y manejar las migraciones | Libre |
| **Login** | **Auth.js** con Google | Inicio de sesión con Gmail | Libre |
| **Roles** | Tabla `usuarios` con campo `rol` (`admin` / `empleado`) + lista de correos permitidos | Que solo entren los autorizados. **El rol se valida en cada Server Action**, no solo en la interfaz | — |
| **Diseño** | **Tailwind CSS** + **shadcn/ui** | Estilos y componentes listos: tablas, formularios, diálogos, menús | Libre |
| **Tablas** | **TanStack Table** | Listado de trabajos con filtros, orden y paginación | Libre |
| **Gráficos** | **Recharts** | Resumen del mes en la pantalla del admin | Libre |
| **Archivos** | **Google Drive API** + **Google Picker** | Crear carpetas, subir archivos y elegir la carpeta del negocio | Gratuito |
| **Planillas** | **Google Sheets**, creadas y leídas con la API de Drive (al subir un archivo se pide convertirlo a Google Sheets; al leer, se exporta). Para la descarga en `.xlsx` y para leer un `.xlsx` subido, una librería como **ExcelJS** | Exportar, importar, respaldos y planilla de contingencia. Se abren en el navegador, en Mac o Windows, sin instalar nada | Gratuito |
| **Hosting** | **Vercel** | Publica automáticamente en cada push a `main`. Ejecuta el cron diario del respaldo | Hobby (gratuito) |
| **App en el celular** | **PWA** | Se instala desde el navegador, sin tienda de apps | — |
| **Código** | **GitHub** | Repositorio conectado a Vercel | Gratuito |

**Cuentas necesarias:** GitHub, Vercel, Neon y un proyecto en Google Cloud (para el login con Google y la API de Drive). Todas en plan gratuito.

---

## 6. Operación y prevención de caídas

Prácticas que debe seguir el desarrollador para evitar caídas o pérdida de datos:

1. **Nunca hacer push directo a `main`** sin antes probar los cambios en una rama y en su enlace de preview de Vercel.
2. **Probar cada migración en la rama de desarrollo de Neon** antes de aplicarla en producción. No borrar ni renombrar una columna en el mismo cambio en que se deja de usar.
3. Cada vez que se agregue una variable de entorno, actualizar `.env.example` **y** revisar que también esté en Vercel.
4. **Actualizar librerías de a una** y probarlas en preview, no todas de golpe.
5. Si algo se rompe en producción, usar **Instant Rollback** de Vercel para volver a la versión anterior.
6. Revisar cada mes las horas de cómputo de Neon (RNF-12) y el espacio de Drive. Recordar que la rama de desarrollo **comparte las horas** con producción.

---

## 7. Plan de contingencia

Qué hacer si el sistema se cae unas horas o días, o si deja de existir. La idea es que **el negocio nunca se detenga** y que, cuando el sistema vuelva, todo quede al día como si nada hubiera pasado.

### 7.1 Qué está disponible aunque el sistema se caiga

| Recurso | Dónde está | ¿Sigue disponible? |
|---|---|---|
| Datos hasta ayer | Respaldo diario en Drive, carpeta "Respaldos" (RF-32) | ✅ Sí. Es un Google Sheets: se abre en el navegador. |
| Archivos de los trabajos | Carpeta del negocio en Drive | ✅ Sí. Drive no depende del sistema. |
| Planilla de contingencia | Carpeta "Respaldos" (RF-33) | ✅ Sí. |
| Lo registrado hoy antes de la caída | Base de datos | ❌ No hasta que vuelva. Se reconstruye con los chats de WhatsApp. |

### 7.2 Paso 1: declarar la contingencia

- El **admin** decide que el sistema está caído y avisa al empleado.
- Desde ese momento **nadie usa el sistema**, aunque vuelva a funcionar a ratos. Todo se anota en la planilla. Así se evita que algo quede registrado dos veces o a medias.

### 7.3 Paso 2: trabajar con la planilla

1. Hacer una copia de la **planilla de contingencia** (en Google Sheets: *Archivo → Hacer una copia*), con la fecha en el nombre, y compartirla con el empleado. Así los dos trabajan en el mismo archivo, desde la PC o el celular.
2. Para consultar trabajos o saldos, abrir el **último respaldo** (solo lectura).
3. Anotar **solo lo que pase durante la caída**, una fila por cada hecho, sin borrar ni editar filas anteriores:

| Hoja | Qué se anota | Columnas |
|---|---|---|
| **Clientes nuevos** | Clientes que no estaban en el sistema | Nombre, WhatsApp, universidad, carrera, ciclo, cómo llegó |
| **Trabajos nuevos** | Trabajos registrados durante la caída | Código, WhatsApp del cliente, tipo, curso, profesor, sección, ciclo, descripción, fecha de entrega, urgencia, precio, responsable, relacionado con (código del trabajo original, si aplica) |
| **Cambios de estado** | Trabajos que avanzaron | Código, nuevo estado, fecha y hora, quién |
| **Pagos** | Pagos recibidos | Código del trabajo, monto, fecha, medio, número de operación, quién lo registró |

- **Códigos de trabajos nuevos:** seguir el correlativo desde el último código usado que aparece en la primera hoja de la planilla. Por ejemplo, si el último fue `PL26-014`, el siguiente es `PL26-015`.
- **Archivos:** guardarlos en una carpeta temporal **"Contingencia"** dentro de la carpeta del negocio, con una subcarpeta por código de trabajo.
- Si hay que corregir algo, se agrega una fila nueva que lo corrige; no se borra la anterior.

### 7.4 Paso 3: cuando el sistema vuelve

1. El admin **importa la planilla** (RF-34) y revisa la vista previa.
2. Confirma la importación. El sistema aplica todo en orden y crea las carpetas de los trabajos nuevos.
3. Mueve a mano los archivos de la carpeta "Contingencia" a la carpeta de cada trabajo, y después la borra.
4. Revisa la pantalla principal (entregas, saldos y pagos del día) para confirmar que todo cuadra.
5. Avisa al empleado que vuelve a usar el sistema.

### 7.5 Si el sistema deja de existir

- Los datos **no se pierden**: los respaldos diarios están en el Drive del dueño, no en una cuenta del desarrollador.
- El negocio puede seguir trabajando solo con la planilla todo el tiempo que haga falta.
- Si después se hace un sistema nuevo, se puede cargar desde el último respaldo y las planillas de contingencia.

---

## 8. Alcance

### Versión 1

RF-01 a RF-46.

### Versión 2

- Catálogo de servicios con precios base y cotización automática
- Pagos a colaboradores y ganancia por trabajo
- Calendario de entregas
- Botón para abrir WhatsApp con un mensaje listo
- Estadísticas: servicios más pedidos, universidades, meses fuertes
- Motivo de cotización perdida (precio, plazo, se fue con otro), para saber si se está cobrando caro
- Organizar las carpetas de Drive por año (`Trabajos / 2026 / PL26-014…`)

### Fuera de alcance

- Acceso de estudiantes
- Facturación electrónica
- Pagos en línea
- Mover automáticamente los archivos antiguos al cambiar de Drive
- Trabajos grupales con varios clientes: aunque el trabajo sea de un grupo, siempre contrata y paga una sola persona
---

## 9. Pendientes de decidir con el dueño

- [ ] Confirmar los estados y sus nombres por ahora usar lo tipico .
- [ ] Definir la lista inicial de tipos de servicio y el **prefijo de dos letras** de cada uno (PL, RD, MQ…).
- [ ] ¿El correlativo de los códigos empieza en 1 o en 100?
- [ ] Decidir si hay datos de hoy (Excel o chats) que pasar al sistema.
- [x] ¿Dónde se guardan los archivos de los trabajos? → En Google Drive, conectado al sistema (sección 3.8).
- [ ] ¿Con qué cuenta de Gmail se conecta el Drive? Conviene la del dueño o una del negocio, no la del empleado.
