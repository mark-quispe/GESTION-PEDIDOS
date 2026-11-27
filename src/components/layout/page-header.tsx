/** Cabecera de página al estilo de una hoja de plano: número de lámina en mono, título y nota. */
export function PageHeader({
  index,
  title,
  description,
  children,
}: {
  index?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        {index && <p className="mb-2 font-mono text-xs text-muted-foreground">{index}</p>}
        <h1 className="text-3xl font-medium">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
