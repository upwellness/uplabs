import type { Metadata } from "next";

/**
 * UP Labs v2 layout.
 * Parallel redesign surface under /v2 (clinical-warm). Inherits fonts + <html>/<body>
 * from the root layout; this wrapper just sets the v2 text baseline and metadata.
 * The Shell (top bar / app switcher / breadcrumb) is rendered per-page so each page
 * can pass its own breadcrumb + session profile.
 */
export const metadata: Metadata = {
  title: "UP Labs v2",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className="font-thai text-ink antialiased">{children}</div>;
}
