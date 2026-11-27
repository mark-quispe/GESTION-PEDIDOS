/**
 * Script en línea que corre antes del primer pintado (guía «Preventing flash» de Next).
 * En el cliente se marca como texto para que React no avise por renderizar un <script>.
 */
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
