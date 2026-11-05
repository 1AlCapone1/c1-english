import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last line of defence: an unexpected error shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[C1] Unhandled UI error", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    const home = import.meta.env.BASE_URL + "#/";
    return <div className="mx-auto max-w-xl px-4 py-16" role="alert">
      <h1 className="font-display text-2xl font-extrabold">Coś poszło nie tak</h1>
      <p className="mt-3 text-ink-soft">Wystąpił nieoczekiwany błąd strony. Twoje dane są bezpieczne. Odśwież stronę albo wróć na stronę główną.</p>
      <p className="mt-2 font-mono text-xs text-ink-soft">{this.state.error.message}</p>
      <div className="mt-5 flex gap-3"><button className="rounded-lg bg-accent px-4 py-2 font-bold text-white" onClick={() => window.location.reload()}>Odśwież</button><a className="rounded-lg border border-black/15 px-4 py-2 font-bold" href={home}>Strona główna</a></div>
    </div>;
  }
}
