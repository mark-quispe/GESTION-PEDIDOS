import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Botones del Design final: primario blanco, secundario con contorno, fantasma y rojo tonal. */
export const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium select-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover-fine:hover:opacity-90",
        secondary: "border border-border bg-surface text-fg hover-fine:hover:border-border-strong hover-fine:hover:bg-hover",
        ghost: "text-muted hover-fine:hover:bg-hover hover-fine:hover:text-fg",
        danger: "border border-danger-line bg-danger-soft text-danger hover-fine:hover:border-danger",
        "danger-solid": "bg-danger text-white hover-fine:hover:opacity-90",
        warning: "border border-warning-line bg-warning-soft text-warning",
        success: "border border-success-line bg-success-soft text-success",
      },
      size: {
        sm: "h-8 px-2.5 text-[12.5px] [&_svg]:size-3.5",
        md: "h-9 px-3 text-[13px] [&_svg]:size-3.5",
        lg: "h-10 px-3.5 text-sm [&_svg]:size-4",
        xl: "h-12 px-5 text-[15px] [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "lg" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, asChild, type, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} type={asChild ? undefined : (type ?? "button")} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
