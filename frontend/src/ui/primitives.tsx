import type { CSSProperties } from 'react'
import { formatMoney } from '../lib/money'
import { initialsOf } from '../lib/names'
import { Icon } from './Icon'

/** Importo in centesimi, con cifre di larghezza fissa per non far "ballare" gli elenchi. */
export function Money({ cents, style }: { cents: number; style?: CSSProperties }) {
  return (
    <span className="tnum" style={style}>
      {formatMoney(cents)}
    </span>
  )
}

/** Barra di avanzamento; `value` va da 0 a 1. */
export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      style={{ height: 8, borderRadius: 99, background: 'rgba(34,28,21,.08)', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.round(clamped * 100)}%`,
          background: 'var(--olive)',
          borderRadius: 99,
          transition: 'width .6s var(--ease)',
        }}
      />
    </div>
  )
}

const AVATAR_COLORS = [
  ['#C0492F', '#F3DDD3'],
  ['#5E6B47', '#E2E6D7'],
  ['#6B3B57', '#EBDBE4'],
  ['#2E6081', '#D7E6F0'],
  ['#9C6311', '#F6E9CC'],
  ['#4A5240', '#E1E4DC'],
] as const

function colorsFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/** Cerchio con le iniziali; il colore dipende dal nome, così resta lo stesso a ogni render. */
export function Initial({ name, size = 36 }: { name: string; size?: number }) {
  const [fg, bg] = colorsFor(name)
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 700,
        fontSize: size * 0.38,
        letterSpacing: '.02em',
      }}
    >
      {initialsOf(name)}
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  Antipasti: 'var(--clay)',
  Primi: 'var(--amber)',
  Secondi: 'var(--plum)',
  Contorni: 'var(--olive)',
  Dolci: '#C77DA0',
  Bevande: 'var(--clay-deep)',
}

export function CategoryDot({ category, size = 8 }: { category?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: (category && CATEGORY_COLORS[category]) || 'var(--ink-3)',
        flexShrink: 0,
      }}
    />
  )
}

type StepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  label: string
}

/** Selettore di quantità; `label` dice a chi usa lo screen reader di cosa si tratta. */
export function Stepper({ value, onChange, min = 0, max = 99, label }: StepperProps) {
  const button = (direction: 1 | -1, disabled: boolean) => (
    <button
      type="button"
      aria-label={`${direction === 1 ? 'Aggiungi' : 'Togli'} ${label}`}
      disabled={disabled}
      onClick={() => onChange(value + direction)}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: '1.5px solid var(--line-2)',
        background: 'var(--paper-3)',
        color: disabled ? 'var(--ink-3)' : 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={direction === 1 ? 'plus' : 'minus'} size={16} stroke={2.2} />
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {button(-1, value <= min)}
      <span
        className="tnum"
        aria-live="polite"
        style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: 17 }}
      >
        {value}
      </span>
      {button(1, value >= max)}
    </div>
  )
}
