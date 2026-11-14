"use client";

import Link from "next/link";
import { useEffect, type ComponentProps, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ logo */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path d="M12 1.6 21 6.8v10.4l-9 5.2-9-5.2V6.8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.2 16.2 9.6v4.8L12 16.8l-4.2-2.4V9.6z" className="fill-glow" />
      </svg>
      <span className="text-[15px] tracking-[-0.03em]">
        Territorial <span className="serif text-[18px] italic">Quest</span>
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- bottoni */
type Variant = "primary" | "glow" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-3 [.on-ink_&]:bg-paper [.on-ink_&]:text-ink [.on-ink_&]:hover:bg-white",
  glow: "bg-glow text-ink hover:brightness-105",
  ghost: "hover:bg-ink/6 [.on-ink_&]:hover:bg-white/10",
  outline: "border hairline hover:bg-ink/5 [.on-ink_&]:hover:bg-white/10",
  danger: "text-alert hover:bg-alert/10",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-13 px-7 text-[15px]",
};
const buttonClass = (variant: Variant, size: Size, className?: string) =>
  cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] whitespace-nowrap",
    "transition-[background,transform,filter] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    VARIANT[variant],
    SIZE[size],
    className,
  );

type ButtonProps = { variant?: Variant; size?: Size } & ComponentProps<"button">;
export function Button({ variant = "primary", size = "md", className, type = "button", ...p }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...p} />;
}
export function LinkButton({
  variant = "primary", size = "md", className, ...p
}: { variant?: Variant; size?: Size } & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}
export function IconButton({ className, label, ...p }: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-grid size-10 shrink-0 place-items-center rounded-full transition active:scale-95",
        "bg-card text-ink shadow-soft hover:bg-paper-2 [.on-ink_&]:bg-ink-3 [.on-ink_&]:text-paper",
        className,
      )}
      {...p}
    />
  );
}

/* -------------------------------------------------------- etichette, tag */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("label soft", className)}>{children}</span>;
}

export function Tag({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx("label inline-flex h-6 items-center gap-1.5 rounded-full border hairline px-2.5", className)}
      style={color ? { color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 9%, transparent)` } : undefined}
    >
      {children}
    </span>
  );
}

export function Dot({ color, live, className }: { color: string; live?: boolean; className?: string }) {
  return (
    <span
      className={cx("inline-block size-2 shrink-0 rounded-full", live && "animate-pulse-ring", className)}
      style={{ background: color, color }}
    />
  );
}

/* --------------------------------------------------------------- pannelli */
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("surface rounded-card border hairline p-5", className)} {...p} />;
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {kicker && <Label>{kicker}</Label>}
        <h2 className="display mt-1 text-[26px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- numeri */
export function Stat({
  label, value, unit, hint, color,
}: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; color?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="display num text-[40px] leading-none" style={{ color }}>{value}</span>
        {unit && <span className="label soft">{unit}</span>}
      </div>
      {hint && <div className="soft mt-1 text-[13px]">{hint}</div>}
    </div>
  );
}

export function Meter({ value, color = "var(--color-leaf)", className }: { value: number; color?: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-ink/8 [.on-ink_&]:bg-white/12", className)}
    >
      <div className="h-full rounded-full transition-[width] duration-700 ease-out-expo" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Anello di avanzamento, usato per gli indicatori collettivi. */
export function Ring({ value, color = "var(--color-leaf)", size = 64, children }: { value: number; color?: string; size?: number; children?: ReactNode }) {
  const r = 26, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="4" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="transition-[stroke-dashoffset] duration-700 ease-out-expo"
        />
      </svg>
      <span className="num text-[13px]">{children ?? `${Math.round(v * 100)}%`}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ campi */
const fieldClass =
  "h-11 w-full rounded-2xl border hairline bg-transparent px-4 text-[15px] outline-none transition placeholder:text-mute focus:border-leaf [.on-ink_&]:focus:border-glow";

export function Field({ label, hint, className, ...p }: { label?: string; hint?: string } & ComponentProps<"input">) {
  return (
    <label className={cx("block", className)}>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <input className={fieldClass} {...p} />
      {hint && <span className="soft mt-1 block text-xs">{hint}</span>}
    </label>
  );
}
export function Area({ label, className, ...p }: { label?: string } & ComponentProps<"textarea">) {
  return (
    <label className={cx("block", className)}>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <textarea className={cx(fieldClass, "h-auto min-h-24 py-3")} {...p} />
    </label>
  );
}
export function Select({ label, className, children, ...p }: { label?: string } & ComponentProps<"select">) {
  return (
    <label className={cx("block", className)}>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <select className={cx(fieldClass, "appearance-none bg-[length:10px] bg-[right_1rem_center] bg-no-repeat pr-9")} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238b8f98' stroke-width='1.5'/%3E%3C/svg%3E\")" }} {...p}>
        {children}
      </select>
    </label>
  );
}

/** Scelta a segmenti: una sola opzione attiva. */
export function Segmented<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; color?: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cx("inline-flex rounded-full border hairline p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cx(
            "h-8 rounded-full px-3.5 text-[13px] font-medium transition",
            value === o.id ? "bg-ink text-paper [.on-ink_&]:bg-paper [.on-ink_&]:text-ink" : "soft hover:text-current",
          )}
          style={value === o.id && o.color ? { background: o.color, color: "#fff" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- dock e foglio */
/** Barra flottante in basso con l'azione primaria: firma dell'interfaccia. */
export function Dock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]", className)}>
      <div className="glass pointer-events-auto flex animate-rise items-center gap-2 rounded-full p-1.5">{children}</div>
    </div>
  );
}

export function Sheet({
  open, onClose, title, kicker, children, wide,
}: { open: boolean; onClose: () => void; title: ReactNode; kicker?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal>
      <button aria-label="Chiudi" className="absolute inset-0 animate-fade bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div className={cx("on-paper relative max-h-[92dvh] w-full animate-rise overflow-y-auto rounded-t-panel p-6 shadow-float sm:rounded-panel sm:p-8", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {kicker && <Label>{kicker}</Label>}
            <h3 className="display mt-1 text-[28px]">{title}</h3>
          </div>
          <IconButton label="Chiudi" onClick={onClose} className="-mt-1 -mr-1 !size-9 !shadow-none">
            <svg viewBox="0 0 14 14" className="size-3.5"><path d="M1 1l12 12M13 1 1 13" stroke="currentColor" strokeWidth="1.6" /></svg>
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed hairline px-6 py-12 text-center">
      <p className="serif text-[28px] italic">{title}</p>
      {children && <p className="soft mx-auto mt-2 max-w-sm text-sm">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const color = tone === "error" ? "var(--color-alert)" : tone === "ok" ? "var(--color-leaf)" : "var(--color-desk)";
  return (
    <p role={tone === "error" ? "alert" : "status"} className="rounded-2xl border px-4 py-3 text-sm"
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      {children}
    </p>
  );
}

export function Spinner({ label = "Carico" }: { label?: string }) {
  return (
    <div className="grid min-h-[40dvh] place-items-center">
      <span className="label soft inline-flex items-center gap-3">
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {label}
      </span>
    </div>
  );
}

export const PlusIcon = () => (
  <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
export const ArrowIcon = () => (
  <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden><path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
