import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-md border bg-surface px-3 text-sm text-fg placeholder:text-faint transition-[border-color] duration-150 hover-fine:hover:border-border-strong focus:border-muted focus:outline-none disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
});

/** Campo con etiqueta, ayuda y error. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
  htmlFor,
  aside,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
  htmlFor?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] text-fg-2">
          {label}
          {optional && <span className="ml-1.5 font-mono text-[11px] text-faint">opcional</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/** Título de sección de formulario: "02 · Trabajo". */
export function FormSection({ n, title, aside, children, className }: { n: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-baseline gap-2 text-sm font-medium">
          <span className="font-mono text-[11px] font-normal text-muted">{n}</span>
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
