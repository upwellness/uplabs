"use client";

/**
 * UP Labs v2 · LINE Bot modal kit (clinical-warm)
 * ────────────────────────────────────────────────
 * Shared, accessible dialog scaffold + form primitives used by the Add/Edit
 * group modals. White surface, rounded-2xl, Lucide close, Escape-to-close,
 * focus on open, touch ≥44px controls. No .liquid / .aurora.
 */

import * as React from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";

export function Modal({
  title,
  eyebrow,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    // focus the dialog container so Escape + screen readers land here
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_20px_50px_-20px_rgba(24,21,26,0.45)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-5 px-5 py-4 lg:px-6">
          <div className="min-w-0">
            {eyebrow && <div className="text-[11px] font-semibold text-ink-40">{eyebrow}</div>}
            <h2 id={titleId} className="mt-0.5 font-head text-[18px] font-extrabold tracking-tight text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 truncate font-mono text-[11px] text-ink-60">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-ink-5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 lg:px-6">{children}</div>

        <div className="flex items-center justify-end gap-2.5 border-t border-ink-5 bg-surface/60 px-5 py-3.5 lg:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-[12px] font-semibold text-ink-60">
      {children}
      {required && <span className="ml-0.5 text-rose">*</span>}
    </span>
  );
}

export const inputCls =
  "mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness/15";

export const selectCls =
  "mt-1.5 w-full min-h-[44px] rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-wellness focus:ring-2 focus:ring-wellness/15";

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-status-danger/20 bg-status-bg-danger px-3.5 py-2.5 text-[13px] text-status-danger">
      <AlertTriangle size={15} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden /> {message}
    </div>
  );
}

export function PrimaryBtn({
  onClick, disabled, busy, children,
}: { onClick: () => void; disabled?: boolean; busy?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-wellness px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[13px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}
