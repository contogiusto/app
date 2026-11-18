/** Marchio: un tondo (il conto) diviso in due parti uguali. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <circle cx="16" cy="16" r="8.5" fill="none" strokeWidth="2.4" opacity=".55" style={{ stroke: 'var(--on-accent)' }} />
      <path d="M16 7.5a8.5 8.5 0 0 1 0 17z" style={{ fill: 'var(--on-accent)' }} />
    </svg>
  )
}
