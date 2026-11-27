# Documento de requerimientos: sistema de gestión de pedidos

| | |
|---|---|
| **Cliente** | Estudio de arquitectura (trabajos para universitarios) |
| **Versión del documento** | 0.9 (borrador) |
| **Fecha** | 22/11/2026 |
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
| **Producción** | Quien hace los trabajos | Tomar trabajos del pozo, avanzarlos y subir archivos |
| **Externo** *(sin cuenta)* | Alguien de fuera del estudio contratado aparte para un trabajo concreto | No entra a la app. Solo aparece como responsable del trabajo que se le encargó |

- **Los roles se combinan.** Una persona puede tener varios, por ejemplo Empleado + Producción, y sus permisos se suman. El Administrador ya incluye todo.
- **Producción puede hacer todo lo que hace Empleado y además Tomar** (aclarado por Mark, 23/11). Quien tiene Producción (o es admin) **toma** trabajos del pozo para sí mismo. Un Empleado sin Producción no puede tomar trabajos. **Nadie asigna un trabajo a otra persona del estudio**, ni siquiera el admin: los trabajos van al pozo y cada uno toma lo que puede. Lo único que se encarga a alguien es un trabajo a un **externo**, y eso lo puede hacer cualquier rol.
- **Externos.** El equipo del estudio entra a la app con su cuenta. Además existen los **externos**: personas ajenas al estudio, contratadas aparte para un trabajo concreto, que **no tienen acceso** a la app. Un empleado o el admin les encarga el trabajo y lo registra a su nombre; quien lo registró sigue el avance y sube los archivos que el externo le manda. Los crea el admin con **"+ Nuevo externo"** en la pestaña Producción (RF-18).

### 2.1 Permisos

"Abierto" = cualquier estado menos Finalizado o Cancelado. "Cerrado" = Finalizado o Cancelado.

| Acción | Admin | Empleado | Producción |
|---|:-:|:-:|:-:|
| Ver trabajos, clientes, precios y contacto | ✅ | ✅ | ✅ |
| Registrar y editar clientes | ✅ | ✅ | ✅ |
| Crear trabajos y cambiar su estado | ✅ | ✅ | ✅ |
| **Tomar** un trabajo del pozo y **soltarlo** | ✅ | ❌ | ✅ |
| Marcar *En proceso* y *Terminado* en sus trabajos | ✅ | ✅ | ✅ |
| **Encargar** un trabajo a un **externo** (desde la ficha) | ✅ | ✅ | ✅ |
| Poner a **otra persona del estudio** como responsable | ❌ | ❌ | ❌ |
| Cambiar precios o dar descuentos (trabajos abiertos) | ✅ | ✅ | ✅ |
| Registrar pagos recibidos | ✅ | ✅ | ✅ |
| Marcar pagos como "revisado" | ✅ | ❌ | ❌ |
| Corregir o anular un pago ya registrado | ✅ | ❌ | ❌ |
| Registrar devoluciones (trabajos abiertos) | ✅ | ✅ | ✅ |
| Editar trabajos cerrados | ✅ | ❌ | ❌ |
| Ver la Agenda (sin montos) | ✅ | ✅ | ✅ |
| Ver la pestaña **Servicios** (precios de referencia y recargo por urgencia), solo lectura | ✅ | ✅ | ✅ |
| Crear servicios, cambiar precios de referencia y el recargo por urgencia | ✅ | ❌ | ❌ |
| Ver Estadísticas | ✅ | ❌ | ❌ |
| Crear y editar externos | ✅ | ✅ | ✅ |
| Escribir notas internas y observaciones del cliente | ✅ | ✅ | ✅ |
| Ver ganancias y pagos a colaboradores | ✅ | ❌ | ❌ |
| Cancelar trabajos | ✅ | ✅ | ✅ |
| **Reabrir** un trabajo cancelado (si no se devolvió el dinero) | ✅ | ✅ | ✅ |
| Eliminar y restaurar registros | ✅ | ❌ | ❌ |
| Gestionar usuarios y accesos | ✅ | ❌ | ❌ |
| Ver el historial de cambios | ✅ | ❌ | ❌ |
| Subir y ver archivos de un trabajo | ✅ | ✅ | ✅ |
| Borrar archivos | ✅ | ❌ | ❌ |
| Conectar o cambiar el Drive | ✅ | ❌ | ❌ |
| Exportar datos | ✅ | ❌ | ❌ |
| Importar datos | ✅ | ❌ | ❌ |

---

## 3. Requerimientos funcionales

### 3.1 Acceso

- **RF-01** Inicio de sesión con cuenta de Google. Al entrar, el sistema solo pide el nombre y el correo del usuario; el permiso de Drive es aparte y solo lo da el admin (RF-22).
- **RF-02** Solo pueden entrar los correos que el admin autorizó. Cualquier otro correo ve la pantalla **"sin acceso"** (RF-52): muestra con qué correo entró, le pide que el admin lo agregue en Usuarios y ofrece **Usar otra cuenta** y **Ver la demo**.
- **RF-03** Cada usuario ve solo las pantallas y acciones de su rol. El admin tiene un botón de ojo junto a su nombre (atajo ⇧E) para **ver la app como empleado**, con un aviso arriba y un enlace para volver.
- **RF-04** El admin puede dar acceso a un usuario, quitárselo y cambiarle los roles. Cada usuario tiene **uno o varios roles** (Empleado, Producción) o es Administrador, que ya incluye todo; debe tener al menos uno. Quitar el acceso se hace con un botón rojo que hay que **mantener presionado 2 segundos**, para que no se active por error. El sistema **no permite quitar el rol ni el acceso al último admin**, para que nunca quede sin administrador.

### 3.2 Clientes

- **RF-05** Registrar al cliente con nombre, WhatsApp, universidad, carrera, ciclo y cómo llegó.
- **RF-06** Buscar clientes por nombre o por número.
- **RF-07** Ver el historial de un cliente: sus trabajos y lo que ha pagado.
- **RF-36** **No puede haber dos clientes con el mismo WhatsApp.** Si el empleado escribe un número que ya existe, el sistema no crea otro cliente: muestra el que ya está registrado y lo usa.
- **RF-38** **Preferencias del cliente.** En su ficha se guardan el software y la versión que usa y su formato habitual. Desde la ficha, el botón **"Nuevo trabajo para este cliente"** abre el formulario con esas preferencias ya completadas. Lo propio de cada pedido (curso, profesor, fechas, precio) siempre se llena de nuevo. Se editan en una ventana flotante: software, formato de entrega, archivos que pide, otras preferencias y el responsable habitual (se calcula solo; solo lo ve el admin).
- **RF-45** **Observaciones del cliente:** notas cortas en su ficha ("paga tarde", "pide muchas correcciones"…). Cada observación es una casilla aparte, con su fecha, y cualquiera que atienda al cliente puede agregar una. Se ven en una caja de alto fijo con scroll. Todos los roles las ven; **quién escribió cada una solo lo ve el admin**. Se agregan desde una ventana flotante (texto, tipo opcional: Pagos/Trato/Entregas/Archivos/Otro, y casilla «Avisar al crear un trabajo nuevo de este cliente»).

### 3.3 Trabajos

- **RF-08** Cada trabajo recibe un **código automático** que lo identifica en el sistema, en Drive y al hablar con el cliente. Formato: **prefijo de la categoría del primer ítem + año + número** (desde 23/11 el prefijo sale del tarifario: PC, PL, PA, LG, DE…; los antiguos CE y LM pasan a PL y LG).

  | Ejemplo | Significado |
  |---|---|
  | `PL26-014` | Planos, 2026, trabajo 14 |
  | `PA26-015` | Panel, 2026, trabajo 15 |
  | `MQ26-016` | Maqueta, 2026, trabajo 16 |

  - El número es un **correlativo único por año** (compartido por todos los tipos) y se reinicia cada enero. Puede empezar en 100 para no revelar el volumen del negocio.
  - Cada tipo de servicio tiene un prefijo de dos letras, que el admin define.
  - **Servicios = tarifario** (aprobado 23/11, reemplaza las 8 tarjetas del flyer). Es el tarifario interno de trampil (PDF en `docs/Tarifario-trampil.pdf`): **15 categorías y 96 ítems**. A la izquierda la lista de categorías (PC·VAL Plano cero y valorización, LA Láminas de presentación, LG Láminas, PL Planos, DE Despieces y detalles, PA Paneles, TO Topografía, MD Modelado 3D y render, BIM, MQ Maquetas, UR Urbanismo y SIG, GEN Cursos generales, EXV Resolución «Trampil», DOC Documentos, IMP Impresión aparte); a la derecha la tabla de ítems de la categoría elegida con código (PL-06), nombre y qué incluye, unidad ("por nivel", "por corte"…), horas estimadas, **FIJO o ×C** y **precio base en casilla con flechas** (de S/ 5 en S/ 5). Arriba: cinta **Recargo por urgencia** (RF-57) y cinta **Factor por ciclo** (ciclo 1–2 ×1.00 fijo; 3 ×1.10; 4 ×1.15; 5 ×1.25; 6 ×1.30; 7 ×1.40; 8 ×1.45; 9–10 ×1.60, con flechas). En la cabecera, "Siguiente número" del correlativo y el botón **Nuevo ítem** (panel lateral: categoría, código automático, nombre, qué incluye, unidad, precio base, horas, ×C o FIJO, y una línea que muestra cuánto costaría en un ciclo alto y cuánto sale por hora). Empleado y Producción ven lo mismo en solo lectura.
  - El código **no cambia** después de creado, aunque luego se edite el tipo de servicio.
  - Es solo una etiqueta: internamente, la base de datos usa su propio ID técnico.

  El trabajo se registra con estos datos: cliente, tipo de servicio, descripción de lo que pide, fecha de entrega (el día en que el cliente quiere recibir el trabajo), urgencia y precio. **Opcionales**, porque muchos clientes no los dan: curso, profesor, sección y ciclo académico (por ejemplo 2026-II). El **responsable no se pide al registrar**: el campo Responsable se quita del formulario y el trabajo cae al pozo (RF-47). En su lugar, con **Estado inicial** en **Confirmado** aparece **"Quién lo hace"**: Por tomar (por defecto, con una nota de que aparecerá en Inicio › Trabajos), Lo hago yo (solo con rol Producción) o Externo (abre la lista de externos). Aprobado 22/11.

  **Urgencia y total (RF-57, aprobado 23/11).** La fila de entrega queda **Fecha de entrega | Urgencia**; ya no hay campo Precio aparte. La urgencia tiene tres botones, **Normal / Alta / Urgente**, cada uno con su recargo en rojo debajo (0 %, +60 %, +100 %). Junto a la etiqueta "Urgencia", una etiqueta blanca con reloj muestra el **plazo** del nivel elegido ("plazo 24 h"). Debajo va **Total a cobrar** en grande, ya con el recargo sumado; al cambiar de nivel solo cambia ese número (sin desglose).
- **RF-58** **Estado inicial y adelanto al registrar** (aprobado 23/11). El Estado inicial solo tiene dos opciones: **Cotización** (por defecto) y **Confirmado**; el estado *Consulta* se quita. Con **Cotización** se guarda sin pago y **no entra al pozo**; una nota lo explica y el botón dice **Guardar cotización**. Al elegir **Confirmado** se despliegan debajo: la tarjeta **Adelanto** (monto con atajos *50 %* y *Todo*, "Queda por cobrar", medio Yape/Plin/Transferencia/Efectivo, n.º de operación y captura opcionales) y **"Quién lo hace"**. El botón pasa a **Crear trabajo y adelanto** y guarda el trabajo y el pago (RF-14) juntos. El 50 % es solo un atajo; el sistema no lo impone.
- **RF-57** **Recargo por urgencia.** Lo fija **solo el admin** en **Servicios**, en una cinta arriba de las tarjetas: para Normal, Alta y Urgente se elige el **plazo** y el **recargo en %** con casillas que suben y bajan de 1 en 1 (flechas ▲▼ o teclado). Normal siempre tiene 0 % (se muestra para tener los tres niveles a la vista). Valores iniciales (del tarifario, aprobados 23/11): **Normal 5 días** (0 %), **Alta 24 h +60 %**, **Urgente 6 h +100 %**. El plazo de Normal se da en días y los otros en horas. El empleado ve el % y el plazo en el formulario pero no los puede cambiar. El recargo se guarda en el trabajo al crearlo, así que cambiar los % después no altera los trabajos ya registrados.
- **RF-59** **Trabajo armado con ítems del tarifario** (aprobado 23/11). En Nuevo trabajo, "Tipo de servicio" se reemplaza por la sección **03 · Lo que se cobra**: una lista de ítems del tarifario (código, nombre, precio base y unidad, factor si es ×C, **cantidad con flechas** e importe). **Agregar ítem** abre un buscador por código o nombre que muestra el precio ya calculado con el ciclo y avisa si el ítem ya está en el trabajo ("ya está ×2"); flechas para elegir y Enter para agregar. Debajo: **Adicional por complejidad** (opcional, en soles), Fecha | Urgencia y **Total a cobrar** grande, con "≈ N h · 2 correcciones incluidas" en pequeño. Fórmula: **Total = Σ(base × cantidad × factor de ciclo si es ×C) × (1 + recargo) + adicional**. Se guardan en el trabajo los precios, factores y horas del momento, así que cambiar el tarifario después no altera trabajos ya registrados.
- **RF-68** **Servicio Personalizado** (aprobado 23/11). Última categoría del tarifario: **OT · Personalizado**, con un único ítem OT-01 «Pedido personalizado» (FIJO, por pedido, precio a mano). En Agregar ítem aparece siempre al final: «+ Personalizado · no está en el tarifario». La línea pide **qué es** (obligatorio, con todo el detalle), cantidad, horas estimadas (opcional) y el **precio acordado con el admin**, que escribe quien registra (empleado o admin). No lleva factor por ciclo; el recargo por urgencia sí se aplica. Si el trabajo solo tiene ítems personalizados, el código empieza con **OT** (p. ej. OT26-001). En Servicios, la categoría muestra los pedidos personalizados recientes con cuántas veces se pidió algo parecido; el admin tiene el botón **Agregar al tarifario** para volverlo un ítem normal. El empleado lo ve solo para consultar. En Estadísticas cuenta como «Personalizado».
- **RF-60** **Ciclo de la carrera obligatorio** (aprobado 23/11). Es el primer campo de "02 · Trabajo": diez botones 1–10 con el factor al lado ("×1.10 en ítems ×C"). Curso, profesor y sección quedan opcionales en una sola fila. El ciclo académico tipo 2026-II se deduce de la fecha.
- **RF-61** **Avance por ítem y soltar a medias** (aprobado 23/11). En la ficha, cada ítem de "Lo que se cobra" tiene una **casilla**: al marcarla queda tachado con las iniciales de quien lo hizo y la fecha. La cabecera muestra el avance con **un cuadrito por ítem** (lleno = hecho) y "2 de 3" (elegido 23/11) y la ficha muestra **"Correcciones 1 de 2 incluidas"**. Al **Soltar** con ítems pendientes, una ventana separa lo que **queda a tu nombre** (cuenta para Producción y Estadísticas por sus horas) y lo que **falta**, que vuelve a Por tomar; se puede dejar una nota para quien lo tome. En el Inicio y la Agenda esos trabajos muestran "falta 1 de 3". Propuesta: **Marcar terminado** solo se activa con todos los ítems marcados. La **barra de estados** de la ficha son **nodos con check** (aprobado 23/11): círculo blanco con check y fecha en los pasos hechos, anillo azul en el actual ("desde …") y círculos huecos en los que faltan, unidos por una línea.
- **RF-62** **Resumen para el cliente** (aprobado 23/11). Botón en la ficha (junto a Editar ítems) y en el pie de Nuevo trabajo. Genera una hoja tipo papel con la marca trampil: código y fecha, cliente con curso y ciclo, fecha de entrega, ítems con cantidad e importe, subtotal, recargo por entrega rápida, total, adelanto 50 % y pendiente, 2 correcciones incluidas, cómo pagar (Yape/Plin) y redes. **No muestra** quién lo hace, quién atendió, horas ni códigos del tarifario. Casillas para ocultar partes; formato imagen o PDF; botones **Enviar por WhatsApp** (abre el chat con la imagen lista, el usuario da enviar), **Copiar imagen** y **Descargar**.

  En el formulario, el cliente se busca escribiendo su nombre o su número: aparece una lista de clientes registrados para elegirlo con un clic. Si es nuevo, se registra ahí mismo empezando por su **celular (WhatsApp)**; si ese número ya existe, el sistema avisa y ofrece usar al cliente existente (RF-36). De forma opcional se pueden adjuntar **los archivos que mandó el cliente**, que se guardan en la subcarpeta **Recibido** al crear el trabajo.
- **RF-09** Cambiar el estado siguiendo este flujo:

  | Estado | Qué significa |
  |---|---|
  | Cotización | Se le dio el precio y falta que confirme (estado por defecto al registrar) |
  | Confirmado | Pagó el adelanto y el trabajo empieza |
  | En proceso | Alguien lo tomó y lo está haciendo |
  | **Terminado** | Hecho, falta enviarlo al cliente. Lo marca quien lo hizo |
  | En revisión por el cliente | Se le envió el trabajo; el cliente lo está viendo (botón **Enviado al cliente** desde Terminado) |
  | Correcciones | Botón **Pidió correcciones** (cuenta 1 de 2 rondas; vuelve a En proceso y luego a Terminado) |
  | **Finalizado** | Botón **Finalizar**: el cliente quedó conforme. La ficha queda apagada y pasa de *En curso* a *Finalizados* |
  | Cancelado | No confirmó o se echó atrás (posible desde cualquier estado) |

  ```
  Confirmado → En proceso → Terminado → En revisión por el cliente → Finalizado
                   ↑                                │
                   └──────── Correcciones ←─────────┘
  ```

  **Producción** marca *En proceso* y *Terminado*. **El empleado**, que habla con el cliente, marca *En revisión por el cliente*, *Correcciones* y *Finalizado*.

  En la **ficha del trabajo**, los pasos del estado incluyen *Terminado*. Si el trabajo es tuyo, la cabecera muestra **Soltar** y **Marcar terminado**. Si está sin tomar, la celda Responsable dice *Por tomar* (en ámbar) y la cabecera muestra el botón **Tomar pedido** siempre visible, con Marcar terminado apagado. En las listas (Inicio, Agenda) Tomar aparece al pasar el mouse. Para un trabajo de un externo, *Terminado* lo marca quien se lo encargó.

- **RF-10** Contar las correcciones hechas en cada trabajo.
- **RF-11** Filtrar los trabajos por estado, responsable, fecha y urgencia.
- **RF-12** La pestaña **Trabajos** muestra una **lista** agrupada en *Atrasados*, *Esta semana* y *Más adelante*, con pestañas *En curso*, *Finalizados* y *Todos* y un buscador por código, cliente o curso. Al elegir un trabajo, su **ficha** se abre al lado: pasos del estado, datos, pagos, archivos y notas. Desde la cabecera de la lista están los botones **Registrar pago** (atajo P) y **+ Nuevo** (atajo N), Registrar pago abre su formulario en un panel a la derecha; **Nuevo trabajo se abre siempre como ventana flotante** sobre la pantalla, igual en Inicio y en Trabajos (23/11). *(Reemplaza al tablero con una columna por estado, que pasa a la versión 2.)* **Actualizado 23/11 (lista escondida a la derecha):** al entrar a Trabajos sin trabajo elegido, la lista ocupa toda la pantalla con columnas Estado, Lo hace (con botón **Tomar** visible en los «Por tomar»), Precio · pendiente y Entrega, y arriba **«Seguir donde te quedaste»** (último trabajo abierto). Al elegir un trabajo, la ficha ocupa todo el ancho; arriba a la izquierda quedan Registrar pago y + Nuevo, y a la derecha «Siguiente», flechas ‹ 3 de 12 › y el botón **Trabajos**, que hace salir la lista de derecha a izquierda encima de la ficha (se cierra al elegir, con X o Esc). En celular es igual (lista a pantalla completa; ficha con Pago, Nuevo, ‹ › y 3/12). Los atrasados llevan **punto rojo** en todas las listas. *Terminado* se muestra en blanco como «Terminado · por enviar» (el verde es solo para Finalizado). Registrar pago en Trabajos sale como panel a la derecha encima de la ficha.
- **RF-13** Marcar automáticamente como **atrasado** todo trabajo cuya fecha de entrega ya pasó sin entregarse. **Regla (23/11):** solo cuenta como atrasado mientras depende del estudio (*Confirmado*, *En proceso*, *Correcciones*) y siempre contra la **fecha vigente**: si una corrección mueve la entrega, el atraso se mide desde la nueva fecha. En *En revisión por el cliente* el reloj no corre.

#### Pedidos repetidos y parecidos

- **RF-35** **Aviso de trabajos del mismo curso.** Al registrar un trabajo, si ya hay otros del mismo **curso, universidad, profesor y ciclo**, el sistema muestra un aviso con esos trabajos y su responsable, para que cada uno salga diferente. Es solo un aviso: no impide guardar. No avisa por los trabajos relacionados del mismo cliente (RF-39).
  - Si el trabajo **no tiene curso**, no hay aviso, porque no hay con qué comparar.
  - Como profesor, sección y ciclo también son opcionales, el aviso compara **solo los datos que estén llenos**. Si únicamente hay curso y universidad, avisa igual, pero como *"posible coincidencia"*, porque es menos seguro.
- **RF-37** **Confirmación de pedido repetido.** Si el cliente ya tiene un trabajo abierto del mismo curso o tipo de servicio, el sistema pregunta: *"Este cliente ya tiene abierto PC26-014. ¿Es un pedido nuevo o es el mismo?"* Si es nuevo, lo crea; si es el mismo, lleva al trabajo existente.
- **RF-46** **Aviso de deuda anterior.** Al crear un trabajo para un cliente con monto pendiente, el sistema muestra lo que debe y de qué trabajo. Es solo un aviso.

#### Trabajos relacionados

- **RF-39** Un trabajo puede estar **relacionado con un trabajo anterior del mismo cliente**. El campo "Relacionado con" **ya no está en el formulario de registro**; la relación se crea desde el trabajo original con un botón "Agregar trabajo relacionado" *(por confirmar)*. Por ejemplo, un avance siguiente o algo nuevo que pidió el profesor. Cada trabajo relacionado tiene su propio código, precio, fecha, estado y pagos.
  - La relación **siempre apunta al trabajo original**, nunca al último, para no formar cadenas.
  - Si el empleado elige por error un trabajo que ya es relacionado, el sistema lo corrige solo y conecta el nuevo al **original de ese trabajo**.
  - Solo se puede relacionar con trabajos del mismo cliente.
  - Desde el trabajo original se ve la lista de sus relacionados, con el total cobrado y lo pendiente de todo el grupo.
- **RF-40** La carpeta de Drive de un trabajo relacionado se crea **dentro de la carpeta del trabajo original**, para que los archivos de todo el proyecto queden juntos.

#### Seguimiento

- **RF-47** **El pozo de trabajos.** Todo trabajo confirmado sin responsable aparece en la tarjeta **"Trabajos"** del Inicio (RF-49). "Pozo" es solo el nombre interno: en pantalla nunca aparece esa palabra. **Dos personas a la vez:** Tomar se guarda con una sola operación en la base de datos que solo funciona si el trabajo sigue sin responsable, así que solo uno lo consigue. Al otro le sale «Ana lo tomó hace un momento» y su lista se actualiza sola. Lo mismo vale para «Yo la tomo» en correcciones y para tomar los ítems que quedaron al soltar.
  - Quien tiene rol Producción (o es admin) pulsa **"Tomar"** y queda como responsable. El trabajo pasa a *En proceso*. El botón aparece **al pasar el mouse** sobre la fila (en el celular está siempre visible).
  - **No existe «Asignar».** Nadie pone a otra persona del estudio como responsable: el trabajo va al pozo y lo toma quien puede. Desde la ficha (Editar → Responsable) solo se puede **encargar a un externo**, y eso lo hace cualquier rol.
  - El responsable puede **"Soltar"** el trabajo para devolverlo al pozo.
  - El historial registra si se **tomó**, se **asignó** o se **soltó**, quién lo hizo y cuándo.
- **RF-41** **Agenda** (antes "Carga"). Vista de 7 días con hoy al medio (3 días atrás y 3 adelante) y una columna de atrasados, sin montos. **La cuadrícula va solo por días, sin filas por persona** (aprobado 23/11):
  - En cada día salen primero los trabajos **sin tomar** (borde ámbar punteado; **Tomar** aparece al pasar el mouse) y debajo los demás, cada uno con las **iniciales** de quien lo tiene. Muestra pendientes, atrasados y también los **finalizados**.
  - Debajo de la leyenda va una **tira de Producción**: una tarjeta por persona con cuántos trabajos tiene en curso y cuántos finalizó en la semana. Solo se ilumina quien tiene trabajos tomados; quien no tiene ninguno se ve apagado ("Sin trabajos tomados") y no se puede elegir.
  - Al hacer clic en una persona, la cuadrícula deja resaltados solo sus trabajos y atenúa el resto; "Ver todos" lo quita.
  - Al hacer clic en un trabajo se abre en la pestaña Trabajos. El aviso "X tiene más espacio esta semana" solo lo ve el admin.
- **RF-44** **Notas internas por trabajo:** un resumen de lo conversado con el cliente, con fecha y autor. Las notas nuevas se suman a las anteriores, como una bitácora.

### 3.4 Pagos

- **RF-14** Registrar cada pago con monto, fecha, medio (Yape, Plin, transferencia o efectivo) y número de operación.
- **RF-15** Los pagos se registran como confirmados al momento. Cada pago tiene una casilla **"revisado"** que marca el admin después de compararlo con su app de Yape o del banco; la vista de pagos se puede filtrar por "sin revisar". Si encuentra un error, lo corrige, y esa corrección queda en el historial (RF-21).
- **RF-16** Calcular automáticamente lo pendiente de cada trabajo, con los pagos registrados. **Anular un pago** (solo admin, con motivo): el pago no se borra, queda tachado con quién, cuándo y por qué, y ese monto vuelve a quedar pendiente. **Precio que cambia** (solo con **Editar** en la ficha: ítems, cantidad, urgencia, adicional o descuento; empleado en trabajos abiertos, admin en cualquiera) — no existe botón «Cambiar precio» aparte (quitado 23/11). **Cambiar urgencia**, en la misma ventana Editar: al subirla la entrega se acorta al plazo del nivel y la diferencia queda pendiente; al bajarla baja el precio y, si ya pagó de más, aparece Devolver. Motivo obligatorio; el admin puede revisar los cambios con el filtro «Precios cambiados» en Pagos: queda en el Historial, y si lo pagado supera el precio nuevo aparece **«Pagado de más S/ X»** con el botón **«Devolver S/ X»**, que abre la devolución (RF-42) ya llena. No hay aviso de «corregir pago»: cada movimiento entra como + o − y deja su huella en el historial de pagos.
- **RF-17** Mostrar el estado de pago de cada trabajo, separado del estado del trabajo: Sin pagar → Adelanto pagado → Pagado completo.
- **RF-42** **Devoluciones.** El empleado y el admin pueden registrar una devolución (monto, fecha, medio y motivo) en **trabajos abiertos**, por ejemplo si un cliente cancela después de pagar el adelanto. Se descuenta de lo pagado y queda en el historial. *(23/11)* El botón **Devolución** de la ficha (sección Pagos) va en rojo tonal y abre una **ventana flotante**: resumen del trabajo (precio, pagado, pendiente); **monto a devolver** que se escribe libre (los atajos "Todo lo pagado" y "Lo del adelanto" solo lo rellenan); **motivo obligatorio** (Canceló el trabajo / Quitó un ítem / Pagó de más / Otro + nota); medio, fecha, n.º de operación opcional y captura (pega o arrastra); casilla **"Pasar el trabajo a Cancelado"** (marcada si el motivo es Canceló; lo hecho queda a nombre de quien lo hizo); abajo, cómo queda lo pagado. Los pagos originales no se tocan: la devolución es un movimiento aparte en negativo, así lo que el estudio se queda (p. ej. S/ 180) sigue contando como ingreso.
- **RF-63** **Anular pedido** *(23/11)*. En la ficha, un tachito rojo junto a Editar (admin y empleado; el menú "···" se quitó el 23/11, tabla 2.1 "Cancelar trabajos") abre una ventana flotante para trabajos que quedaron en el aire. Pide **motivo obligatorio** (No pagó el adelanto / Pagó y desapareció / El cliente lo canceló / Otro) y una nota, y qué hacer con lo pagado: **Se queda con lo pagado** o **Devolver dinero** (despliega ahí mismo la devolución de RF-42: monto libre, una parte o todo, medio, operación y captura). Se confirma manteniendo presionado 2 s. El trabajo pasa a **Cancelado**: sale de Por tomar, Agenda e Inicio; lo hecho queda a nombre de quien lo hizo; no se borra (Trabajos › Todos). **Reabrir** lo puede hacer cualquiera si no se devolvió dinero, y el trabajo sigue desde el paso donde quedó; si ya se devolvió, no se reabre: la ficha ofrece **«+ Nuevo pedido desde este»** (código nuevo, datos ya llenos y enlace «Retoma PC26-014»), para que las cuentas del pedido anterior queden cerradas. La ficha cancelada muestra una franja roja con quién, cuándo, motivo, nota y cuánto se quedó el estudio, y lo pendiente tachado "no se cobra". El motivo también aparece en Pagos (debajo de cada devolución) y en el Historial ("anuló el pedido"). Anular y Devolución pueden terminar en lo mismo: Anular parte de cancelar (y opcionalmente devolver); Devolución parte de devolver (y opcionalmente cancelar).
- **RF-64** **Continuar trabajo** *(23/11)*. La ficha **Finalizada** se ve apagada, con una franja verde (quién y cuándo finalizó) y el botón **+ Continuar trabajo**. Sirve cuando un cliente vuelve porque su trabajo creció. Abre la ventana de Nuevo trabajo con el título "Continuar trabajo", una franja "Continúa PC26-014" y los datos del cliente, curso y ciclo ya puestos; solo se agregan los ítems nuevos. Crea un **trabajo nuevo** con **código nuevo**, su propia carpeta de Drive con acceso a la anterior, y deja en ambas fichas el enlace **Continúa PC26-014 / Siguió en PL26-017**. El trabajo anterior no se reabre ni cambia sus pagos. Si alguien registró una continuación como trabajo nuevo: al elegir un cliente con trabajos finalizados, Nuevo trabajo muestra «Este cliente tiene PC26-014 finalizado. ¿Es continuación?» con **Vincular**; y en la ficha está **Vincular a un trabajo anterior**. Vincular no cambia el código ni los precios (propuesta, falta boceto).
- **RF-65** **Correcciones** *(23/11)*. Botón **«Corrección N/2»** en la ficha mientras está *En proceso* (entre Editar y Soltar) y **«Pidió correcciones»** en *En revisión por el cliente*; ambos abren la misma ventana y **cuentan como una de las 2 rondas** del cliente. La ventana pide: qué pidió corregir; **nueva fecha de entrega** (atajos Misma fecha / +1 / +2 / +3 días / Otra, con la anterior tachada); **¿Se cobra?** (*Incluida · ronda N de 2* o *Se cobra aparte*); **¿Quién hace la corrección?** (*Por tomar* por defecto, le sale a todo Producción; *Yo la tomo*, pasa a tu nombre con «Tomar y empezar corrección»; o *Externo…*). Nunca se pone a otra persona del estudio y **Lo recibió** (quien registra, con hora). Si se cobra: monto que indica el admin (se escribe o con flechas de S/ 1) y **¿Pagó ahora?** (medio, n.º de operación y «Pega o arrastra» la captura, que queda en Pagos como «Pago corrección N») o *Lo paga después* (sube lo pendiente). **3.ª corrección o más:** aviso ámbar «Ronda 3 · fuera de las 2» y se elige *Error del estudio · no se cobra* (pide «¿Qué falló?», no descuenta rondas, cuenta en Historial y Estadísticas) o *Pedido extra del cliente · se cobra* (se consulta el monto al admin). La ficha en corrección muestra una franja ámbar «Corrección N de 2», el paso «Correcciones N de 2», la entrega «Lun 23/11 · antes 21/11» y el botón **«Corrección hecha»**, que la pasa a Terminado. Por definir con el dueño: si el error del estudio tampoco gasta rondas en la 1.ª y 2.ª.
- **RF-66** **Extras** *(23/11)*. Lo que se cobra por una corrección grande o pedido extra va en una sección **Extras** de la ficha, aparte de «Lo que se cobra»: el **precio pactado no cambia**. Cada extra muestra motivo, quién lo registró, cuándo, si está pagado y el monto. En Pagos el pago lleva la etiqueta «extra · corrección N». El pie queda: *Precio pactado + Extras = Total · Pagado · Pendiente*.
- **RF-67** **Notas de la ficha** *(23/11)*. Solo apuntes de quienes toman el trabajo (lo que pide el cliente va por Corrección, nunca a Notas). La pestaña muestra un **numerito ámbar** cuando hay una nota sin leer (por ejemplo, la que deja quien soltó el trabajo), y esa nota se resalta como «nueva». Escribir un apunte: caja + Guardar.
- **RF-48** **Trabajos cerrados.** Cuando un trabajo está *Finalizado* o *Cancelado*, solo el admin puede editarlo: precio, pagos, devoluciones o datos. El empleado puede cambiar el precio y registrar devoluciones solo mientras el trabajo está abierto.
- **RF-43** **Captura del comprobante.** Al registrar un pago se puede adjuntar, de forma opcional, la imagen del Yape o la transferencia. Se guarda en la subcarpeta **"Pagos"** del trabajo en Drive (se crea al subir la primera captura) y queda enlazada a ese pago.

### 3.5 Producción (antes "Responsables")

- **RF-18** La pestaña **Producción** (solo admin) muestra a los usuarios con rol Producción y a los **externos** (con la etiqueta "Externo · sin acceso"): una tarjeta por persona con sus trabajos **en curso** y las **horas que hizo** en el periodo, y arriba una barra **Horas hechas** con cómo se repartieron (semana, mes, 3 meses o año). Desde el 23/11 se cuenta por **ítem marcado como hecho** (RF-61), con las horas del tarifario, aunque el trabajo siga abierto o lo termine otra persona. Al abrir una tarjeta se ven los ítems que hizo. No se muestran atrasos por persona: un atraso es del trabajo, no de quien lo hizo. Para agregar a alguien del equipo, el admin le da el rol Producción en Usuarios (RF-04). El botón **«+ Agregar»** abre un panel a la derecha con dos opciones: **Del estudio · con cuenta** (nombre, Gmail, celular opcional y roles; es lo mismo que darle el rol en Usuarios) o **Externo · sin acceso** (nombre, celular, una nota y **qué hace**, elegido con el mismo buscador de ítems del tarifario que Nuevo trabajo, para sugerirlo al encargar). A la gente del estudio no se le pone «qué hace»: no limita lo que puede tomar.

### 3.6 Pantalla principal

- **RF-19** La pantalla de **Inicio** muestra, para todos los roles:
  - **Franja de la semana:** las entregas de cada día.
  - **Trabajos:** el pozo de trabajos por tomar (ver RF-49).
  - **Terminados por enviar:** trabajos listos, con el botón **Enviado al cliente**, que los pasa a *En revisión por el cliente*.
  - **Atrasados**, **cotizaciones sin respuesta** y **pendientes por cobrar**.
- **RF-49** **Tarjeta "Trabajos" del Inicio.** Es el pozo, pero en pantalla se llama solo **"Trabajos"**: ahí llegan los pedidos nuevos para que alguien los tome. Reemplaza a "Tus trabajos" (empleado) y a "Finalizados esta semana" (admin). La tarjeta "Atrasados" se queda.
  - **Arriba, solo si los hay:** hasta **2 trabajos muy atrasados o urgentes** (tengan responsable o no), marcados con "+N días" o "Urgente" y su responsable. Si hay más de 2, aparece el enlace *"Ver los N atrasados"*.
  - **El resto de la tarjeta es el pozo:** trabajos sin responsable, ordenados por fecha de entrega, con los urgentes marcados. Si no hay atrasados, toda la tarjeta es pozo.
  - Cada fila muestra el código, la descripción, el cliente y la fecha de entrega.
  - En el pozo, quien tiene Producción ve el botón **Tomar** al pasar el mouse: rectángulo de esquinas suaves con contorno y una flecha en un cuadrito blanco. No hay botón Asignar (ver RF-47).
  - Encima de la franja de la semana hay una leyenda **Prioridad**: rojo Urgente, ámbar Alta, gris Normal.
  - Enlace **"Ver todo en Agenda"** al pie.
- **RF-20** Para el admin muestra además: pagos de hoy, ingresos del mes y la ventanita **Sistema** del menú (Drive, respaldo diario y planilla de contingencia).
- **RF-50** **Carga y cotizaciones del admin.** En el Inicio del admin, la tarjeta **"Carga por responsable"** comparte lugar con **"Cotizaciones sin respuesta"**: se ve una u otra y se cambia con un clic. Se cambia con dos pestañas en la cabecera de la tarjeta, Carga | Cotizaciones (aprobado 22/11). Cada fila es un enlace: en Carga abre **Trabajos** filtrado por ese responsable; en Cotizaciones abre la **ficha** de esa cotización. Al pie, el enlace **"Ver en Trabajos →"**.

### 3.6.1 Estadísticas

- **RF-51** **Estadísticas** (solo admin), con su propia entrada en el menú de Administración, debajo de Pagos. Selector de periodo **1 semana / 4 semanas / 12 semanas / Todo**; con 1 semana todo se cuenta por día (p. ej. «Ingresos en la semana») y las comparaciones son contra el periodo anterior equivalente («vs semana pasada», «vs 4/12 semanas anteriores»). Orden (rediseño 23/11): números clave; **Preferencia de pago** (anillo con un color por medio: Yape morado, Plin turquesa, Transferencia azul, Efectivo naranja; única excepción a «color solo para estados») junto a **Días con más pedidos**; **Cuánto entra por cada medio** (tarjetas con total, n.º de pagos y pago promedio) junto a **Tiempo promedio de entrega**; Ingresos y Cotizaciones; **Desempeño del equipo** (tarjeta por persona con pedidos tomados + columna comparable + tendencia, ítems hechos, horas y veces que soltó; externos marcados; sin atrasos por persona); **Servicios** (Ítems más pedidos con «vs periodo anterior», Por ciclo de la carrera, Se piden juntos); **Clientes, pagos y entregas** (Tiempo promedio en tomar un pedido con línea y por prioridad, Clientes que más piden, Entregas a tiempo, Urgencia y recargo, Pendientes por cobrar, Clientes nuevos y que vuelven); **Dinero y correcciones** (Dinero que entra y sale, Motivo de pedidos anulados, Correcciones por semana con la serie «Error del estudio · no se cobra», Precios cambiados). Botón **Descargar Excel** junto al selector: baja en un .xlsx todos los datos de la página para el periodo elegido (una hoja por bloque). Sin calendario de cuadritos.

### 3.6.2 Entrada, demo y apariencia

- **RF-52** **Página de entrada.** Antes de iniciar sesión se ve una lámina de arquitectura: la planta de un local cuya puerta de entrada se dibuja al cargar, con cajetín y la frase **«Todo el taller en un solo lugar.»** Tiene dos botones: **Entrar con Google** y **Ver la demo**, y abajo a la izquierda los enlaces a las **redes del estudio** (iconos de un solo color, sin mostrar el @). Si el correo no está autorizado, se muestra la pantalla **"sin acceso"** (RF-02): la misma entrada con un aviso rojo (aprobado 22/11).
- **RF-53** **Demo.** "Ver la demo" entra **como administrador** a una copia del estudio con **datos ficticios**, sin pedir cuenta. Usa una rama aparte de la base de datos (Neon, rama `demo`) que **se reinicia cada noche**; lo que el visitante cambie se borra. Una marca siempre visible dice que es una demo y tiene el botón **Salir de la demo**: una franja arriba (aprobado 22/11). La demo no toca Drive real: subir archivos muestra un aviso. No hace más lenta la app; solo comparte las horas de cómputo de Neon (RNF-12).
- **RF-54** **Modo claro, oscuro o según el sistema.** Se cambia con el selector de tres iconos del menú. **Por defecto, oscuro.** El modo claro es "papel": fondo crema, tarjetas casi blancas, texto negro, contornos de tinta en tarjetas y botones, y los colores de estado algo más oscuros. Ambos modos llevan el fondo cuadriculado de lámina.
- **RF-55** **Redes del estudio.** El admin escribe los enlaces (Instagram, TikTok, Facebook, WhatsApp) en Configuración › Estudio; solo se muestran los que estén llenos.
- **RF-56** **Configuración** (solo admin) se organiza en un submenú: **Drive** (conectado / desconectado), **Estudio** (nombre, logo y redes), **Respaldo** y **Avisos**. Los avisos se muestran así: cotización sin respuesta → tarjeta del Inicio; monto pendiente → "Pendientes por cobrar" del Inicio; Drive lleno o respaldo fallido → tarjeta **Sistema** del menú admin.

### 3.7 Historial y eliminación

- **RF-21** Registrar quién cambió qué y cuándo en los estados, los precios y los pagos. Cada pago muestra quién lo registró y, si fue corregido, el valor anterior y el nuevo. También registra el **avance en producción**: quién tomó un trabajo, cada ítem que marcó como hecho y cuándo lo soltó con pendientes (qué hizo, qué falta y su nota). Filtros "Tomados y soltados" e "Ítems hechos" (23/11).
- **RF-29** **Nada se borra de verdad.** Al eliminar un cliente, trabajo o pago, el registro se marca como eliminado y se oculta. El admin tiene una vista de eliminados desde donde puede **restaurarlos**.

### 3.8 Archivos (Google Drive)

- **RF-22** El admin conecta su Google Drive desde la configuración, **una sola vez**, con el botón "Conectar Drive":
  - Google le muestra la pantalla de permiso y él acepta.
  - El sistema guarda la llave de acceso (refresh token) **cifrada** en la base de datos.
  - Se abre el selector de Google (**Google Picker**) y el admin elige la carpeta del negocio que ya existe en su Drive. Esto se hace **una sola vez**: al elegirla, la app recibe permiso sobre esa carpeta.
  - El sistema guarda el ID de esa carpeta como **raíz**. Desde ahí, todo lo que crea, sube o mueve (carpetas de trabajos, archivos y la carpeta "Respaldos") queda **dentro de esa carpeta** y en ningún otro lugar del Drive.
  - Todo se guarda en el Drive del admin. Para que los demás puedan abrir los archivos, **al dar acceso a un usuario (RF-04) la app comparte automáticamente la carpeta raíz con su Gmail**, y al quitarle el acceso deja de compartirla. Así el empleado y Producción ven y abren las carpetas desde la app o desde su propio Drive ("Compartidos conmigo").
- **RF-23** Al registrar un trabajo, el sistema crea su carpeta **dentro de la raíz**, con el nombre `PL26-014 - Cliente - Descripción corta`, y dentro tres subcarpetas: **Recibido**, **Avances** y **Entrega final**. Guarda en la base de datos el ID de la carpeta y de cada subcarpeta. Como el sistema usa los IDs y no los nombres, si alguien renombra o mueve una carpeta en Drive, no se rompe nada.
- **RF-24** La ficha del trabajo tiene una pestaña **Archivos** con tres secciones (Recibido, Avances, Entrega final); cada una tiene su botón "Subir aquí" y acepta arrastrar archivos, así la subcarpeta se elige sola. El archivo se guarda en Drive y el sistema guarda solo su ID, enlace, nombre, tamaño, quién lo subió y cuándo.
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

Hoy el negocio funciona de manera informal y no tiene reglas fijas. Por eso, **en la versión 1 el sistema no impone ninguna regla** y solo registra los datos. La única excepción es el **recargo por urgencia (RF-57)**, que el admin configura en Servicios. El precio, el adelanto y las correcciones se manejan caso por caso, como hasta ahora.

Lo que el sistema sí guarda (adelantos, correcciones y urgencia) le servirá al dueño para decidir más adelante si quiere fijar reglas como estas:

| Posible regla futura | Ejemplo |
|---|---|
| Adelanto mínimo para empezar | 50 % |
| Correcciones incluidas en el precio | 2 |
| Pago al colaborador | % o monto fijo según el servicio |

### 4.1 Única regla fija: corrección o trabajo nuevo

Para que el empleado sepa cuándo cobrar:

- **Corrección:** cambios sobre lo que ya se acordó. Se cuenta en RF-10 y **no se cobra aparte**.
- **Trabajo relacionado:** algo **nuevo** que no estaba en el pedido original, como una lámina o presentación extra que agregó el profesor. Se registra como trabajo relacionado (RF-39) y **tiene su propio precio**.

---

## 5. Requerimientos no funcionales

- **RNF-01** El sistema se construye con el stack definido en la sección 5.1.
- **RNF-02** Se publica en Vercel en cada push a `main`. La base de datos tiene una rama de desarrollo y otra de producción.
- **RNF-03** Funciona bien en el celular y se puede instalar como app (PWA). En el celular, el menú izquierdo se convierte en una barra de pestañas abajo con Inicio, Trabajos, Clientes, Agenda y Más (aprobado 22/11). Las acciones que en la computadora salen al pasar el mouse (Tomar) están siempre visibles, con al menos 36 px de alto.
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
  - La rama `demo` (RF-53) **suma a estas horas** cuando alguien la usa. Se apaga sola a los 5 minutos sin visitas; si las visitas a la demo crecen mucho, se puede desactivar el botón.
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
| **Roles** | Tabla `usuarios` con su lista de roles (`admin`, `empleado`, `produccion`; uno o varios) + lista de correos permitidos | Que solo entren los autorizados. **El rol se valida en cada Server Action**, no solo en la interfaz | — |
| **Diseño** | **Tailwind CSS** + **shadcn/ui** | Estilos y componentes listos: tablas, formularios, diálogos, menús | Libre |
| **Tablas** | **TanStack Table** | Listado de trabajos con filtros, orden y paginación | Libre |
| **Gráficos** | **Recharts** | Resumen del mes en la pantalla del admin | Libre |
| **Archivos** | **Google Drive API** + **Google Picker** | Crear carpetas, subir archivos y elegir la carpeta del negocio | Gratuito |
| **Planillas** | **Google Sheets**, creadas y leídas con la API de Drive (al subir un archivo se pide convertirlo a Google Sheets; al leer, se exporta). Para la descarga en `.xlsx` y para leer un `.xlsx` subido, una librería como **ExcelJS** | Exportar, importar, respaldos y planilla de contingencia. Se abren en el navegador, en Mac o Windows, sin instalar nada | Gratuito |
| **Hosting** | **Vercel** | Publica automáticamente en cada push a `main`. Ejecuta el cron diario del respaldo | Hobby (gratuito) |
| **App en el celular** | **PWA** | Se instala desde el navegador, sin tienda de apps | — |
| **Código** | **GitHub** | Repositorio conectado a Vercel | Gratuito |

**Cuentas necesarias:** GitHub, Vercel, Neon y un proyecto en Google Cloud (para el login con Google y la API de Drive). Todas en plan gratuito.

### 5.2 Seguridad

**Acceso**
- **RNF-13** Solo entran los correos de la lista de Usuarios. La sesión vence a los 30 días; el rol y el acceso se releen de la base en cada acción, así quitar a alguien vale al instante.
- **RNF-14** Cada Server Action revisa el rol en el servidor antes de hacer algo. Ocultar un botón nunca cuenta como permiso.

**Datos**
- **RNF-15** Claves y contraseñas solo en las variables de entorno de Vercel, nunca en el código ni en el repositorio (que puede ser público). `.env*` está en `.gitignore`, salvo `.env.example`.
- **RNF-16** La llave de Drive (refresh token) se guarda cifrada.
- **RNF-17** Todo lo que llega de un formulario se valida con Zod en el servidor. Las consultas van por Drizzle, nunca armando SQL a mano.
- **RNF-18** Cabeceras de seguridad en todas las páginas, para que la app no se pueda meter dentro de otra web ni cargar scripts de otros sitios.

**Disponibilidad**
- **RNF-19** Límite de peticiones por persona en el inicio de sesión, la demo y las acciones de guardar (firewall de Vercel).
- **RNF-20** La demo tiene un interruptor para apagarla, y su base (rama `demo`) no puede tocar la de producción.
- **RNF-21** El respaldo diario y la contingencia (RF-32 a RF-34) son el plan si se pierden datos.

**Mantenimiento**
- **RNF-22** Dependabot de GitHub activo para avisar de librerías con fallas.
- **RNF-23** Revisión de seguridad del código antes de cada publicación importante.
- **RNF-24** El historial (RF-21) registra también los inicios de sesión y los cambios de usuarios y roles.

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
2. Para consultar trabajos o pendientes, abrir el **último respaldo** (solo lectura).
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
4. Revisa la pantalla principal (entregas, pendientes por cobrar y pagos del día) para confirmar que todo cuadra.
5. Avisa al empleado que vuelve a usar el sistema.

### 7.5 Si el sistema deja de existir

- Los datos **no se pierden**: los respaldos diarios están en el Drive del dueño, no en una cuenta del desarrollador.
- El negocio puede seguir trabajando solo con la planilla todo el tiempo que haga falta.
- Si después se hace un sistema nuevo, se puede cargar desde el último respaldo y las planillas de contingencia.

---

## 8. Alcance

### Versión 1

RF-01 a RF-67.

### Versión 2

- Tablero de trabajos con una columna por estado (antes RF-12)
- Catálogo de servicios con precios base y cotización automática
- Pagos a colaboradores y ganancia por trabajo
- Calendario de entregas
- Botón para abrir WhatsApp con un mensaje listo
- Motivo de cotización perdida (precio, plazo, se fue con otro), para saber si se está cobrando caro
- Organizar las carpetas de Drive por año (`Trabajos / 2026 / PL26-014…`)
- **Pedidos y estado desde la página de entrada** *(se evalúa al terminar el sistema de gestión)*: el cliente registra su pedido y adjunta archivos (directo a Drive, con límite de tamaño y tipo); el botón abre WhatsApp con "Ya registré el pedido PL26-…"; el pedido entra como *Consulta* y el empleado lo revisa y cotiza. El cliente puede ver el estado con su código + los últimos 4 dígitos de su WhatsApp. Protección: la página es estática (no despierta Neon), captcha (Cloudflare Turnstile), límite de pedidos y consultas por persona, opcionalmente una cola (p. ej. Upstash) para que lo público no gaste horas de Neon, alerta de consumo e interruptor para apagar el formulario. Implica revisar el plan de Vercel (Hobby es no comercial) y la regla "los estudiantes nunca entran".

### Fuera de alcance

- Acceso de estudiantes
- Facturación electrónica
- Pagos en línea
- Mover automáticamente los archivos antiguos al cambiar de Drive
- Trabajos grupales con varios clientes: aunque el trabajo sea de un grupo, siempre contrata y paga una sola persona
---

## 9. Cambios de la versión 0.9

- 23/11 noche (6): RF-68 Servicio Personalizado (OT).
- 23/11 noche (5): RF-51 botón Descargar Excel; serie «Error del estudio · no se cobra».
- 23/11 noche (4): RF-51 Estadísticas rediseñada (selector con 1 semana, pagos con color por medio, desempeño del equipo, servicios, dinero y correcciones).
- 23/11 noche (3): quitado «Cambiar precio» de Pagos; ventana Editar con cambio de urgencia (subir/bajar), motivo obligatorio y filtro «Precios cambiados».
- 23/11 noche (2): RF-63 Reabrir para todos si no hubo devolución, si no «Nuevo pedido desde este»; RF-65 quién hace la corrección = Por tomar / Yo la tomo / Externo; RF-16 pago anulado y pagado de más; RF-18 «+ Agregar» del estudio o externo; RF-38/RF-45 ventanas de preferencias y observaciones.
- 23/11 noche: Tabla 2.1 corregida: Producción = Empleado + Tomar; nadie asigna a otra persona del estudio, solo se encarga a externos (cualquier rol); Reabrir cancelado para todos si no hubo devolución. Pendiente: **manual de instrucciones** con fotos por proceso (buscable con Ctrl+F).
- 23/11: RF-12 lista escondida a la derecha + pantalla de entrada + celular; RF-13 atrasado solo cuando depende del estudio y contra la fecha vigente; RF-65 Correcciones (botón en proceso, nueva fecha, se cobra/incluida, ronda 3 error o extra); RF-66 Extras; RF-67 Notas con numerito.
- 23/11: «Saldo» se renombra a **«Pendiente»** en toda la app (Pendientes por cobrar, Pendiente contra entrega, etc.), porque «saldo» sonaba a dinero a favor (Mark).
- 23/11: Estados renombrados: En revisión → **En revisión por el cliente** (botones Enviado al cliente / Pidió correcciones / Finalizar), Entregado → **Finalizado** (ficha apagada; pestaña Finalizados). Menú "···" quitado de las fichas. RF-64 Continuar trabajo.
- 23/11: Fondo de todas las ventanas = semidifuminado (negro 50 % + desenfoque 2 px); se quitan las 3 opciones.
- 23/11: RF-63 Anular pedido (tachito junto a ···, motivo obligatorio, se queda con lo pagado o devolver dinero, ficha cancelada con franja roja; motivo en Pagos e Historial).
- 23/11: RF-42 Devolución con botón rojo en la ficha y ventana flotante (monto libre, motivo obligatorio, opción de cancelar el trabajo). RF-21 registra tomar, ítems hechos y soltar con pendientes.
- 23/11: Nuevo trabajo se abre como ventana flotante en todas partes (RF-12); la captura del adelanto usa el recuadro "Pega o arrastra" igual que Registrar pago. Fondo de las ventanas: 3 opciones para que elija el dueño (no es un ajuste del sistema).
- 23/11: Tarifario trampil integrado: Servicios = 15 categorías y 96 ítems con factor por ciclo (RF-08), RF-59 trabajo con ítems, RF-60 ciclo obligatorio, RF-61 avance por ítem y soltar a medias, RF-62 Resumen para el cliente. RF-57 con Normal 5 días, Alta 24 h +60 %, Urgente 6 h +100 %. Prefijos CE→PL y LM→LG. Producción y Estadísticas miden **horas hechas** por ítem (RF-18, RF-51).

- Roles: Producción ve lo mismo que Empleado y solo suma **Tomar**. Se agregan los **externos** (sin acceso a la app); salen de "Fuera de alcance".
- RF-08: se quita el campo Responsable del formulario Nuevo trabajo.
- RF-09: estado *Terminado* en la ficha, con Tomar / Soltar / Marcar terminado.
- RF-47, RF-49 y RF-41: Tomar aparece al pasar el mouse; sin botón Asignar en Inicio ni Agenda (se asigna desde la ficha); la Agenda **no** tiene fila "Por tomar".
- RF-49: la tarjeta Trabajos reemplaza a "Tus trabajos" y "Finalizados esta semana"; Atrasados se queda. Leyenda Prioridad.
- RF-18: la pestaña Producción incluye a los externos y el panel "+ Nuevo externo".
- Nuevos: RF-50 (Carga / Cotizaciones en el Inicio admin), RF-51 (Estadísticas por semana, pasa de la versión 2 a la 1), RF-52 (página de entrada y "sin acceso"), RF-53 (demo), RF-54 (modo claro papel, oscuro por defecto), RF-55 (redes del estudio), RF-56 (submenú de Configuración y avisos).
- 23/11: RF-58 Estado inicial Cotización (por defecto) | Confirmado; se quita Consulta; Confirmado despliega Adelanto y Quién lo hace.
- 23/11: Servicios visible para Empleado y Producción en solo lectura (menú, debajo de Agenda); crear o cambiar servicios, precios y recargo, solo admin.
- 23/11: RF-57 recargo por urgencia (plazo y % por nivel en Servicios, solo admin; en Nuevo trabajo se quita Precio y queda Total a cobrar).
- RNF-03: versión celular. RNF-12: la demo comparte las horas de Neon.
- Nueva sección 5.2 Seguridad (RNF-13 a RNF-24).
- Todos los bocetos de esta versión quedaron aprobados el 22/11 y están en el Design final.

## Cambios de la versión 0.8

- RF-22: la app comparte la carpeta raíz de Drive con cada usuario al darle acceso.
- 5.1: un usuario puede tener varios roles.
- RF-12: la lista con ficha reemplaza al tablero por estado (el tablero pasa a la versión 2).
- RF-38: se quita "responsable habitual" del cliente.
- RF-45, RF-41, RF-18, RF-24, RF-03, RF-04 y RF-08: se ajustan a lo que ya está en el Design final.
- RF-49: la tarjeta se llama "Trabajos"; arriba avisa hasta 2 trabajos muy atrasados o urgentes.

---

## 10. Pendientes de decidir con el dueño

- [ ] **Manual de instrucciones** (Mark, 23/11): un documento por proceso (registrar pedido, cobrar, corrección, devolución, anular, cancelación, reabrir…) con pasos y fotos de la pantalla, para que el empleado busque con Ctrl+F la palabra que le interesa. Se hace con las pantallas finales.
- [x] **Fondo de las ventanas** → definido por Mark (23/11): **todas las ventanas con semidifuminado** (fondo negro 50 % + desenfoque 2 px).

- [ ] Confirmar los estados y sus nombres por ahora usar lo tipico .
- [x] ~~Lista inicial de servicios (del flyer)~~ → reemplazada por el tarifario completo (23/11). Antes: lista del flyer (23/11), con prefijo propuesto y precio de referencia: **PA** Panel Arquitectónico (desde S/ 250) · **PC** Plano Cero (S/ 120 por nivel; asesoría S/ 60 y pasado a limpio S/ 60) · **LD** Lámina de Detalle (S/ 90 por lámina) · **CE** Cortes y Elevaciones (S/ 60 por corte) · **LM** Láminas (S/ 60 por lámina) · **VP** Valorización de Planos (S/ 40 por lámina) · **CG** Cursos Generales (S/ 100 por informe, S/ 40 por punto) · **RT** Resolución «Trampil» (S/ 100 examen de 5 solo texto, S/ 150 con gráficos y cálculo). Los prefijos se pueden cambiar.
- [ ] **Regla para el monto extra por dificultad** (Adicional por complejidad y corrección grande que se cobra aparte). Por ahora es un monto libre que se consulta al admin; falta definir una tabla o criterio (por ejemplo por horas extra × S/ por hora del tarifario). Pendiente con el dueño (Mark, 23/11).
- [ ] ¿El correlativo de los códigos empieza en 1 o en 100?
- [ ] Decidir si hay datos de hoy (Excel o chats) que pasar al sistema.
- [x] ¿Dónde se guardan los archivos de los trabajos? → En Google Drive, conectado al sistema (sección 3.8).
- [x] ¿Con qué cuenta de Gmail se conecta el Drive? → Una cuenta de Gmail dedicada del negocio (15 GB).
- [ ] Activar verificación en 2 pasos en las cuentas clave (Gmail del admin y del Drive, GitHub, Vercel, Neon, Google Cloud). El dueño lo hará más adelante.
- [x] Redes del estudio (del flyer): WhatsApp 946 779 608, Facebook «trampil», Instagram @trampil. Falta solo el enlace de TikTok, si tienen.
