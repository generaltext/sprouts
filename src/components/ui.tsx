// Small shared UI primitives. Deliberately plain — the app's warmth comes from
// the palette and layout, not from heavy components.

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'subtle' }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none'
  const variants = {
    primary: 'bg-accent text-accent-fg hover:opacity-90',
    default: 'border border-line2 bg-panel text-fg hover:bg-panel-2',
    ghost: 'text-fg2 hover:bg-panel-2 hover:text-fg',
    subtle: 'bg-panel-2 text-fg2 hover:text-fg',
  }
  return <button type="button" className={`${base} ${variants[variant]} px-3 py-2 ${className}`} {...props} />
}

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg3 transition-colors hover:bg-panel-2 hover:text-fg ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: color, width: size, height: size }} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-fg3">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg4">{hint}</span>}
    </label>
  )
}

export function TextInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-line2 bg-panel px-3 py-2 text-sm text-fg outline-none placeholder:text-fg4 focus:border-accent ${className}`}
      {...props}
    />
  )
}

/** A bottom sheet on phones, a centered dialog on wider screens. Closes on
 *  Escape and backdrop click. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,16,10,0.45)] backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="card card-shadow flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-b-none rounded-t-2xl outline-none sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** A segmented single-choice control. */
export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-line2 bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? 'bg-panel text-fg shadow-sm' : 'text-fg3 hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children, color }: { active?: boolean; onClick?: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'border-accent bg-accent-soft text-fg' : 'border-line2 text-fg3 hover:bg-panel-2'
      }`}
    >
      {color && <ColorDot color={color} size={8} />}
      {children}
    </button>
  )
}
