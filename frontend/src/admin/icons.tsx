import type { ReactNode } from 'react'

// Icone che il prototipo usa solo nel pannello ristoratore (stesso tratto di `ui/Icon`).
const PATHS = {
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  refresh: <path d="M20 11A8 8 0 006 6L4 8M4 4v4h4M4 13a8 8 0 0014 5l2-2M20 20v-4h-4" />,
  print: (
    <g>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </g>
  ),
  book: <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13" />,
} satisfies Record<string, ReactNode>

export type AdminIconName = keyof typeof PATHS

export function AdminIcon({ name, size = 18 }: { name: AdminIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  )
}
