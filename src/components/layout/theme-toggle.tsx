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
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
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

/** RF-54: selector de tres iconos (claro, oscuro, sistema). */
export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la preferencia solo existe en el navegador
    setPref(readPref());
  }, []);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (value: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {}
    setPref(value);
    apply(value);
  };

  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex gap-0.5 rounded-lg border p-[3px]", className)}>
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
              "press grid h-7 w-[30px] place-items-center rounded-[5px] text-muted transition-colors duration-150 hover-fine:hover:text-fg",
              active && "bg-line text-fg",
            )}
          >
            <Icon className="size-[15px]" strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
