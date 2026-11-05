export type Theme = "system" | "light" | "dark";
export function applyTheme(t: Theme) {
  try { localStorage.setItem("theme", t); } catch { /* storage may be blocked */ }
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
export function currentTheme(): Theme { try { return (localStorage.getItem("theme") as Theme) || "system"; } catch { return "system"; } }
