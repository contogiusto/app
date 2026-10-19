/** Iniziali per l'avatar: "Anna Russo" → "AR", "anna" → "A", nome vuoto → "?". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}
