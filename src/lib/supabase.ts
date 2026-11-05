import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configError = !url || !key ? "Brak konfiguracji Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Zobacz README." : null;

export const supabase = createClient(url || "http://invalid.local", key || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
});

/** Throw a readable Polish error for any Supabase error object. */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(translateError(res.error.message));
  return res.data;
}
export function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nieprawidłowy e-mail lub hasło.";
  if (m.includes("email not confirmed")) return "Potwierdź adres e-mail – link wysłaliśmy w wiadomości po rejestracji.";
  if (m.includes("user already registered")) return "Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.";
  if (m.includes("password should be")) return "Hasło jest za słabe – użyj co najmniej 8 znaków.";
  if (m.includes("rate limit")) return "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
  if (m.includes("jwt expired")) return "Sesja wygasła – zaloguj się ponownie.";
  if (m.includes("forbidden") || m.includes("permission denied") || m.includes("row-level security")) return "Brak uprawnień do tej operacji.";
  return msg;
}
