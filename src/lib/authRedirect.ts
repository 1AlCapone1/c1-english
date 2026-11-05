/**
 * Auth links from e-mails (sign-up confirmation, password reset) land on the app with parameters
 * in the query string or in the URL fragment, e.g.
 *   ?token_hash=…&type=email          (our e-mail template – processed only after the user clicks "Potwierdź weryfikację")
 *   ?code=…                           (Supabase /verify redirect, PKCE)
 *   ?error=…&error_code=otp_expired   or  #error=…&error_code=…   (expired / used link)
 * The app uses HashRouter, so a fragment such as "#error=…" would otherwise be treated as a route.
 * This module reads the parameters once, before React renders, removes them from the address bar
 * and sends the user to #/auth/confirm (or #/update-password for recovery links).
 */
export type AuthLink = {
  tokenHash: string | null; type: string | null; code: string | null;
  error: string | null; errorCode: string | null; errorDescription: string | null;
};
const KEYS = ["token_hash", "type", "code", "error", "error_code", "error_description", "access_token", "refresh_token", "expires_in", "expires_at", "token_type", "sb", "flow"];

export function parseAuthLink(search: string, hash: string): AuthLink | null {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  // fragment may be "#error=…" / "#access_token=…" (no route) or "#/route?x=…" / "#/route#error=…"
  let frag = hash.replace(/^#/, "");
  if (frag.startsWith("/")) { const qi = frag.indexOf("?"), hi = frag.indexOf("#"); frag = qi >= 0 ? frag.slice(qi + 1) : hi >= 0 ? frag.slice(hi + 1) : ""; }
  const hParams = new URLSearchParams(frag);
  const get = (k: string) => q.get(k) ?? hParams.get(k);
  const link: AuthLink = { tokenHash: get("token_hash"), type: get("type"), code: q.get("code"), error: get("error"), errorCode: get("error_code"), errorDescription: get("error_description") };
  return link.tokenHash || link.code || link.error || link.errorCode ? link : null;
}

let pending: AuthLink | null = null;
export function captureAuthLink(): void {
  if (typeof window === "undefined") return;
  const link = parseAuthLink(window.location.search, window.location.hash);
  if (!link) return;
  pending = link;
  const q = new URLSearchParams(window.location.search);
  KEYS.forEach((k) => q.delete(k));
  const rest = q.toString();
  const target = link.type === "recovery" && !link.error && !link.errorCode ? "#/auth/confirm?next=password" : "#/auth/confirm";
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + target);
}
/** Returns the captured link once (so a page reload does not re-run the same token). */
export function takeAuthLink(): AuthLink | null { const l = pending; pending = null; return l; }
export function peekAuthLink(): AuthLink | null { return pending; }

export type ConfirmProblem = "expired" | "invalid" | "other_device" | "server" | "network" | "already";
/** Map Supabase errors (from URL or API) to a user-facing category. */
export function classifyAuthError(code: string | null | undefined, message: string | null | undefined, status?: number): ConfirmProblem {
  const c = (code ?? "").toLowerCase(), m = (message ?? "").toLowerCase();
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed") || c === "network") return "network";
  if (m.includes("already confirmed") || m.includes("already been confirmed") || c === "email_already_confirmed") return "already";
  if (c.includes("code_verifier") || m.includes("code verifier") || c === "flow_state_not_found" || c === "flow_state_expired" || m.includes("flow state")) return "other_device";
  if (c === "otp_expired" || m.includes("expired") || m.includes("invalid or has expired")) return "expired";
  if ((status ?? 0) >= 500 || c === "unexpected_failure" || m.includes("internal") || m.includes("database error")) return "server";
  return "invalid";
}
export const isTokenHash = (t: string | null) => !!t && /^(pkce_)?[a-f0-9]{40,64}$/i.test(t);
