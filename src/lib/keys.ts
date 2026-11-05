import { useEffect, useRef } from "react";

/**
 * Keyboard support: Enter works like the visible "Sprawdź" / "Dalej" button.
 * Rules: holding Enter (key-repeat) does nothing, one key press runs at most one action (a press
 * used by an answer field is marked and ignored by page-level handlers), Shift+Enter and IME
 * composition are left alone, and multi-line fields (Writing) keep normal Enter unless they opt in
 * with data-enter="submit".
 */
const handled = new WeakSet<object>();

type KeyEv = { key: string; repeat: boolean; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault: () => void; nativeEvent?: { isComposing?: boolean }; isComposing?: boolean };
const plainEnter = (e: KeyEv) => e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !(e.isComposing ?? e.nativeEvent?.isComposing);

/** Call from an onKeyDown handler. Returns true when this Enter press should run the action. */
export function claimEnter(e: KeyEv): boolean {
  if (!plainEnter(e)) return false;
  e.preventDefault();
  const native = (e as { nativeEvent?: object }).nativeEvent ?? (e as object);
  if (e.repeat || handled.has(native)) return false;
  handled.add(native);
  return true;
}

/** Global capture listener: holding Enter must not click through buttons (native activation repeats otherwise). */
export function installEnterGuard() {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t?.tagName === "TEXTAREA" && t.dataset.enter !== "submit") return; // free typing in Writing
    e.preventDefault();
  }, true);
}

/**
 * Run `handler` when Enter is pressed anywhere on the page while `enabled` is true —
 * unless the key press was already used by a field or lands on a control with its own Enter behaviour.
 */
export function useEnter(handler: () => void, enabled: boolean) {
  const ref = useRef(handler); ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const dbg = (window as unknown as { __enterLog?: string[] }).__enterLog;
      dbg?.push(`key=${e.key} prevented=${e.defaultPrevented} handled=${handled.has(e)} plain=${plainEnter(e)} target=${(e.target as HTMLElement | null)?.tagName}`);
      if (e.defaultPrevented || handled.has(e) || !plainEnter(e)) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if ((tag === "TEXTAREA" && !(t as HTMLTextAreaElement).readOnly) || tag === "SELECT" || tag === "A" || (tag === "BUTTON" && !t?.hasAttribute("data-enter-pass"))) return;
      if (tag === "INPUT" && !(t as HTMLInputElement).readOnly && (t as HTMLInputElement).type !== "radio" && !t?.hasAttribute("data-enter-pass")) return;
      if (!claimEnter(e)) return;
      ref.current();
    };
    // registered after the current key press finishes, so the press that enabled it can't trigger it
    const id = window.setTimeout(() => { window.addEventListener("keydown", onKey); (window as unknown as { __enterLog?: string[] }).__enterLog?.push("registered"); }, 0);
    return () => { window.clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [enabled]);
}
