export type ThemePref = "light" | "dark" | "system";
export const THEME_KEY = "tema";

/**
 * Script en línea que corre antes del primer pintado: lee la preferencia guardada
 * y fija data-theme en <html>, así no hay destello del tema equivocado.
 * RF-54: por defecto, oscuro.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"dark";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="dark"}})()`;
