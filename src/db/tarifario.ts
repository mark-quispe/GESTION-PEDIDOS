/**
 * Tarifario interno de trampil (docs/Tarifario-trampil.pdf, aprobado 23/11).
 * Carga inicial de la pestaña Servicios; después lo mantiene el admin.
 * [código, nombre, qué incluye, unidad, horas, FIJO|×C, precio base, ★]
 */
import type { PricingMode } from "./schema";

type Row = [code: string, name: string, includes: string | null, unit: string, hours: number | null, mode: "F" | "C", price: number, starred?: boolean];

export type TarifaCategory = { code: string; prefix: string; name: string; isCustom?: boolean; items: Row[] };

export const TARIFARIO: TarifaCategory[] = [
  {
    code: "PC",
    prefix: "PC",
    name: "Plano cero y valorización",
    items: [
      ["PC-01", "Plano cero – Etapa 1: diagramación abstracta en AutoCAD (asesoría)", "Flujos, explicación de pasadizos, cuartos y distribución", "por nivel", 3, "F", 60, true],
      ["PC-02", "Plano cero – Etapa 2: pasado a limpio en DWG (AutoCAD)", "Bocetos a medidas reales, con mobiliario y a escala", "por nivel", 4, "F", 60, true],
      ["VAL-01", "Valorización de planos: acomodo en lámina para ploteo", "Servicio aparte, siempre al final: acomodo según rúbrica, listo para plotear e imprimir", "por lámina", 1.5, "F", 40, true],
    ],
  },
  {
    code: "LA",
    prefix: "LA",
    name: "Láminas de presentación",
    items: [
      ["LA-01", "Lámina A3 de presentación", "Diagramación, textos y gráficos con tu material", "por lámina", 2, "C", 35],
      ["LA-02", "Lámina A2 de presentación", "Diagramación, textos y gráficos con tu material", "por lámina", 3.5, "C", 60],
      ["LA-03", "Lámina A1 de presentación", "Diagramación completa formato A1", "por lámina", 6, "C", 100],
      ["LA-04", "Lámina A0 de presentación", "Diagramación completa formato A0", "por lámina", 8, "C", 140],
      ["LA-05", "Lámina de análisis de referentes (A1)", "Investigación, gráficos y diagramas del referente", "por lámina", 7, "C", 120],
      ["LA-07", "Lámina de detalle de mobiliario (A1)", "Vistas, cortes, despiece y cotas del mueble", "por lámina", 8, "C", 130],
    ],
  },
  {
    code: "LG",
    prefix: "LG",
    name: "Láminas",
    items: [
      ["LG-01", "Lámina de isométricos", "Isometría del proyecto o de un elemento", "por lámina", 3.5, "F", 60, true],
      ["LG-02", "Lámina de volumétricos", "Estudio de volumen, masas y proporción", "por lámina", 3.5, "F", 60, true],
      ["LG-03", "Lámina de axonometría / vista explotada", "Axonometría o despiece explotado general", "por lámina", 3.5, "F", 60, true],
      ["LG-04", "Lámina de perspectivas (1 y 2 puntos de fuga)", "A mano o digital", "por lámina", 3.5, "F", 60, true],
      ["LG-05", "Lámina de conceptualización / idea rectora", "Concepto, idea rectora y diagramas de forma", "por lámina", 3.5, "F", 60, true],
      ["LG-06", "Lámina de zonificación y diagramas de flujos", "Zonas, relaciones y circulaciones", "por lámina", 3.5, "F", 60, true],
      ["LG-07", "Lámina de análisis de sitio", "Asoleamiento, vientos, accesos, visuales", "por lámina", 3.5, "F", 60, true],
      ["LG-08", "Lámina de emplazamiento y contexto", "Relación del proyecto con su entorno", "por lámina", 3.5, "F", 60, true],
      ["LG-09", "Lámina de collage / moodboard de materiales", "Materialidad, texturas y paleta de colores", "por lámina", 3.5, "F", 60, true],
      ["LG-10", "Lámina de proceso de diseño", "Bocetos y evolución de la propuesta", "por lámina", 3.5, "F", 60, true],
    ],
  },
  {
    code: "PL",
    prefix: "PL",
    name: "Planos",
    items: [
      ["PL-01", "Plano de ubicación y localización", "Cuadro normativo y de áreas", "por plano", 2.5, "C", 50],
      ["PL-02", "Planta de distribución hasta 150 m²", "Muros, vanos, cotas, niveles y rótulos", "por nivel", 4, "C", 70],
      ["PL-03", "Planta de distribución mayor a 150 m²", "Muros, vanos, cotas, niveles y rótulos", "por nivel", 6, "C", 110],
      ["PL-04", "Planta amoblada con pisos (adicional)", "Mobiliario y trama de pisos", "por nivel", 3, "C", 50],
      ["PL-05", "Plano de techos", "Pendientes, montantes, cotas", "por plano", 2, "C", 40],
      ["PL-06", "Corte arquitectónico", "Niveles, alturas, materiales", "por corte", 3, "F", 60, true],
      ["PL-07", "Elevación arquitectónica", "Materiales, vanos, sombras", "por elevación", 2.5, "C", 45],
      ["PL-08", "Plano de cimentación (nivel académico)", "Cimientos, zapatas, detalles típicos", "por nivel", 3, "C", 60],
      ["PL-09", "Plano de aligerados / estructuras (académico)", "Losas, vigas, columnas", "por nivel", 3, "C", 60],
      ["PL-10", "Instalaciones eléctricas", "Circuitos, leyenda, cuadro de cargas básico", "por nivel", 3, "C", 55],
      ["PL-11", "Instalaciones sanitarias (agua y desagüe)", "Redes, leyenda, detalles", "por nivel", 3, "C", 55],
      ["PL-12", "Cuadro de vanos y acabados", null, "por cuadro", 1.5, "C", 35],
      ["PL-13", "Plano de evacuación y señalización", "Rutas, aforo, señalética", "por nivel", 3, "C", 55],
      ["PL-14", "Plot plan / plano general del conjunto", null, "por plano", 4, "C", 80],
      ["PL-15", "Digitalización de plano a mano o escaneado a CAD", null, "por plano", 2, "C", 40],
    ],
  },
  {
    code: "DE",
    prefix: "DE",
    name: "Despieces y detalles",
    items: [
      ["DE-01", "Despiece de escalera (planta, corte y detalle)", null, "por escalera", 4, "C", 70],
      ["DE-02", "Despiece de puerta o ventana", "Por cada tipo de vano", "por tipo", 2, "C", 35],
      ["DE-03", "Despiece de baño o cocina (planta + 4 elevaciones)", null, "por ambiente", 4, "C", 70],
      ["DE-04", "Detalle constructivo (muro, cimiento, encuentro)", null, "por detalle", 2, "C", 40],
      ["DE-05", "Despiece de mueble (vistas, cortes y piezas)", null, "por mueble", 5, "C", 80],
      ["DE-06", "Despiece de muro de albañilería (aparejo)", null, "por muro", 2, "C", 40],
      ["DE-07", "Detalle de techo o cobertura", null, "por detalle", 2.5, "C", 45],
      ["DE-08", "Lámina de detalle básico (escala 1:5 y 1:10)", "Con más detalle va de S/ 100 a S/ 150 según lo que pida el docente", "por lámina", 6, "F", 90, true],
    ],
  },
  {
    code: "PA",
    prefix: "PA",
    name: "Paneles",
    items: [
      ["PA-01", "Panel de arquitectura A1", "Precio base: sube según la información y el modelo que pida el cliente", "por panel", 10, "F", 250, true],
      ["PA-02", "Panel de arquitectura A0", "Precio base: sube según la información y el modelo que pida el cliente", "por panel", 12, "F", 250, true],
      ["PA-03", "Panel de arquitectura A2", "Precio base: sube según la información y el modelo que pida el cliente", "por panel", 10, "F", 250, true],
      ["PA-04", "Panel de arquitectura A3", "Precio base: sube según la información y el modelo que pida el cliente", "por panel", 12, "F", 250, true],
      ["PA-05", "Adaptación de contenido existente a panel", null, "por panel", 3, "C", 60],
    ],
  },
  {
    code: "TO",
    prefix: "TO",
    name: "Topografía",
    items: [
      ["TO-01", "Plano topográfico con curvas de nivel", "Desde puntos de campo o estación total", "por plano", 6, "C", 120],
      ["TO-02", "Procesamiento de libreta / puntos de campo", null, "por levantamiento", 4, "C", 80],
      ["TO-03", "Perfil longitudinal", null, "por perfil", 2, "C", 45],
      ["TO-04", "Secciones transversales (juego de 5)", null, "por juego", 3, "C", 60],
      ["TO-05", "Cálculo de cortes y rellenos (volúmenes)", null, "por cálculo", 5, "C", 90],
      ["TO-06", "Plano perimétrico con coordenadas UTM", "Cuadro de datos técnicos", "por plano", 3, "C", 70],
      ["TO-07", "Curvas de nivel desde Google Earth / Civil 3D", null, "por plano", 4, "C", 90],
      ["TO-08", "Informe de práctica topográfica", null, "por informe", 3, "C", 50],
    ],
  },
  {
    code: "MD",
    prefix: "MD",
    name: "Modelado 3D y render",
    items: [
      ["MD-01", "Modelado 3D SketchUp (vivienda hasta 150 m²)", null, "por modelo", 7, "C", 120],
      ["MD-02", "Modelado 3D SketchUp (edificio / equipamiento)", null, "por modelo", 12, "C", 220],
      ["MD-03", "Render exterior", null, "por imagen", 2, "C", 45],
      ["MD-04", "Render interior", null, "por imagen", 2, "C", 40],
      ["MD-06", "Recorrido virtual (video de 1 min)", null, "por video", 8, "C", 160],
      ["MD-07", "Postproducción en Photoshop", null, "por imagen", 1, "C", 20],
    ],
  },
  {
    code: "BIM",
    prefix: "BI",
    name: "BIM (Revit)",
    items: [
      ["BIM-01", "Modelo Revit de arquitectura", null, "por nivel", 6, "C", 120],
      ["BIM-02", "Lámina generada desde Revit", null, "por lámina", 2, "C", 40],
      ["BIM-03", "Familia paramétrica Revit", null, "por familia", 3, "C", 50],
      ["BIM-04", "Tablas de metrado desde Revit", null, "por juego", 3, "C", 60],
      ["BIM-05", "Modelo de estructuras o instalaciones en Revit", null, "por nivel", 6, "C", 110],
    ],
  },
  {
    code: "MQ",
    prefix: "MQ",
    name: "Maquetas",
    items: [
      ["MQ-01", "Maqueta conceptual / abstracta", "Materiales aparte", "por maqueta", 5, "C", 80],
      ["MQ-02", "Maqueta volumétrica", "Materiales aparte", "por maqueta", 9, "C", 150],
      ["MQ-03", "Maqueta de detalle", "Materiales aparte", "por maqueta", 18, "C", 320],
      ["MQ-04", "Maqueta topográfica (terreno en curvas)", "Materiales aparte", "por maqueta", 10, "C", 180],
      ["MQ-05", "Maqueta urbana (manzanas)", "Materiales aparte", "por maqueta", 14, "C", 250],
    ],
  },
  {
    code: "UR",
    prefix: "UR",
    name: "Urbanismo y SIG",
    items: [
      ["UR-01", "Plano de usos de suelo", null, "por plano", 5, "C", 90],
      ["UR-02", "Plano de sistema vial y secciones viales", null, "por plano", 5, "C", 90],
      ["UR-03", "Plano de equipamientos urbanos", null, "por plano", 4, "C", 80],
      ["UR-04", "Mapa SIG temático (QGIS / ArcGIS)", null, "por mapa", 3.5, "C", 70],
      ["UR-05", "Lámina de diagnóstico urbano (A1)", null, "por lámina", 8, "C", 150],
      ["UR-06", "Plan maestro / master plan", null, "por plano", 12, "C", 220],
      ["UR-07", "Sección vial detallada", null, "por sección", 2, "C", 40],
      ["UR-08", "Análisis de llenos y vacíos / alturas", null, "por plano", 3, "C", 60],
    ],
  },
  {
    code: "GEN",
    prefix: "GE",
    name: "Cursos generales",
    items: [
      ["GEN-01", "Trabajo o examen de curso general – por punto", "1 punto = 1 tarea independiente que genera un solo informe (Comunicación, Realidad Peruana, exámenes grupales)", "por punto", 2, "F", 40, true],
      ["GEN-02", "Infografía de curso general", "Se cobra como 1 punto", "por infografía", 2, "F", 40, true],
      ["GEN-03", "Informe de curso general", "Un informe completo de curso general (todas las carreras)", "por informe", null, "F", 100, true],
    ],
  },
  {
    code: "EXV",
    prefix: "EX",
    name: "Resolución «Trampil»",
    items: [
      ["EXV-01", "Resolución «Trampil» en vivo – paquete de 5 preguntas", "Preguntas no conocidas antes; se resuelven en el momento. Equivale a S/ 20 por pregunta", "por paquete", 1, "F", 100, true],
      ["EXV-02", "Resolución «Trampil» en vivo – pregunta individual", "Pregunta suelta, fuera de paquete", "por pregunta", 0.25, "F", 30, true],
      ["EXV-03", "Resolución «Trampil» con gráficos y cálculo – examen completo (5 preguntas)", "Gráficos, parábolas, topografía, cálculo. Equivale a S/ 30 por pregunta", "por paquete", 1.5, "F", 150, true],
      ["EXV-04", "Resolución «Trampil» con gráficos y cálculo – pregunta individual", "Pregunta suelta con gráfico o cálculo", "por pregunta", 0.4, "F", 40, true],
    ],
  },
  {
    code: "DOC",
    prefix: "DO",
    name: "Documentos",
    items: [
      ["DOC-01", "Memoria descriptiva", null, "por documento", 3, "C", 60],
      ["DOC-02", "Informe o monografía", "Precio por página", "por página", 0.5, "C", 8],
      ["DOC-03", "Presentación PPT", "Precio por diapositiva", "por diapositiva", 0.3, "C", 6],
      ["DOC-04", "Programación arquitectónica (cuadro de áreas)", null, "por cuadro", 3, "C", 60],
      ["DOC-05", "Matriz de consistencia / esquema de tesis", null, "por documento", 5, "C", 90],
      ["DOC-06", "Especificaciones técnicas", null, "por documento", 4, "C", 80],
      ["DOC-07", "Metrado y presupuesto básico", null, "por documento", 6, "C", 120],
      ["DOC-08", "Cuadro de verificación normativa (RNE)", null, "por cuadro", 2.5, "C", 50],
      ["DOC-09", "Organigrama y flujograma funcional", null, "por lámina", 2, "C", 40],
    ],
  },
  {
    code: "IMP",
    prefix: "IM",
    name: "Impresión aparte",
    items: [
      ["IMP-01", "Ploteo A1 a color", "Referencial, según imprenta", "por unidad", null, "F", 12],
      ["IMP-02", "Impresión A3 a color", "Referencial, según imprenta", "por unidad", null, "F", 3],
      ["IMP-03", "Montaje en foam / cartón pluma A1", "Referencial, según imprenta", "por unidad", 0.5, "F", 20],
    ],
  },
  {
    code: "OT",
    prefix: "OT",
    name: "Personalizado",
    isCustom: true,
    items: [["OT-01", "Pedido personalizado", "No está en el tarifario: precio acordado con el admin", "por pedido", null, "F", 0]],
  },
];

export const toPricingMode = (m: "F" | "C"): PricingMode => (m === "F" ? "fijo" : "ciclo");

/** RF-08: factor por ciclo de la carrera. */
export const DEFAULT_CYCLE_FACTORS: Record<string, number> = {
  "1": 1,
  "2": 1,
  "3": 1.1,
  "4": 1.15,
  "5": 1.25,
  "6": 1.3,
  "7": 1.4,
  "8": 1.45,
  "9": 1.6,
  "10": 1.6,
};

/** RF-57: Normal 5 días (0 %), Alta 24 h (+60 %), Urgente 6 h (+100 %). */
export const DEFAULT_URGENCY = {
  normal: { hours: 120, pct: 0 },
  alta: { hours: 24, pct: 60 },
  urgente: { hours: 6, pct: 100 },
};
