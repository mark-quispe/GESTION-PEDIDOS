export type ThemePref = "light" | "dark" | "system";
export const THEME_KEY = "tema";

/**
 * Script en línea que corre antes del primer pintado: lee la preferencia guardada
 * y fija data-theme en <html>, así no hay destello del tema equivocado.
 */
export const themeScript = `(function(){try{var p=localStorage.getItem("${THEME_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})()`;
