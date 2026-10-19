import type { CSSProperties, ReactNode } from 'react'

// Icone del prototipo (tratto 1.6, colore ereditato).
const PATHS = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M20 6L9 17l-5-5" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  card: (
    <g>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 10h20" />
    </g>
  ),
  cash: (
    <g>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </g>
  ),
  table: <path d="M3 9h18M5 9l1.5 11M19 9l-1.5 11M4 5h16v4H4z" />,
  clock: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </g>
  ),
  lock: (
    <g>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </g>
  ),
  qr: (
    <g>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21h.01" />
    </g>
  ),
  receipt: (
    <g>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </g>
  ),
  split: (
    <g>
      <path d="M12 3v18" strokeDasharray="2 3" />
      <path d="M5 8l-2 4 2 4M19 8l2 4-2 4" />
    </g>
  ),
  pin: (
    <g>
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </g>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

type Props = {
  name: IconName
  size?: number
  stroke?: number
  style?: CSSProperties
}

export function Icon({ name, size = 20, stroke = 1.6, style }: Props) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  )
}
