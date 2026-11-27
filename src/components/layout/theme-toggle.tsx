"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  // Cambio instantáneo: se desactivan las transiciones durante un fotograma.
  root.classList.add("theme-switching");
  root.dataset.theme = dark ? "dark" : "light";
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la preferencia solo existe en el navegador
    setPref(readPref());
  }, []);

  // Si sigue al sistema, reacciona cuando el sistema cambia de tema.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (value: ThemePref) => {
    try {
      if (value === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {}
    setPref(value);
    apply(value);
  };

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-lg border bg-muted p-0.5", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              "grid size-10 place-items-center rounded-md text-muted-foreground transition-[color,background-color,transform] duration-150 ease-(--ease-out) hover:text-foreground active:scale-[0.97] sm:size-8",
              active && "bg-card text-foreground shadow-xs",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
