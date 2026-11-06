// One shade per avatar family; app theme colors remain independent.
export const connectionAvatarColors = [
  '#db4aa6', // Pink
  '#1d8dba', // Blue
  '#f2571d', // Orange
  '#0d8a4b', // Green
  '#986dc4', // Purple
  '#dc4b50', // Red
  '#d6ab23', // Yellow
  '#16a085', // Emerald
  '#6065c9', // Indigo
  '#10b9cc', // Cyan
  '#8bbd35' // Lettuce
] as const

const colors = new Map<string, string>()
const customColors = new Map<string, string>()

function readColor(id: string): string | undefined {
  const cached = colors.get(id)
  if (cached) return cached

  try {
    const saved = localStorage.getItem(`zap.connectionAvatar.${id}`)
    return connectionAvatarColors.find((candidate) => candidate === saved)
  } catch {
    return undefined
  }
}

function saveColor(id: string, color: string) {
  colors.set(id, color)

  try {
    localStorage.setItem(`zap.connectionAvatar.${id}`, color)
  } catch {
    /* Keep the same color in memory for this session. */
  }
}

export function pickAvatarColor(used: Iterable<string>, preferred?: string): string {
  const counts = new Map<string, number>(connectionAvatarColors.map((color) => [color, 0]))
  for (const color of used) {
    if (counts.has(color)) counts.set(color, counts.get(color)! + 1)
  }

  const minimum = Math.min(...counts.values())
  const available = connectionAvatarColors.filter((color) => counts.get(color) === minimum)
  if (preferred && available.some((color) => color === preferred)) return preferred

  return available[Math.floor(Math.random() * available.length)]
}

function customColor(id: string): string | undefined {
  const cached = customColors.get(id)
  if (cached) return cached

  try {
    const saved = localStorage.getItem(`zap.connectionAvatarChoice.${id}`)
    return connectionAvatarColors.find((color) => color === saved)
  } catch {
    return undefined
  }
}

export function setConnectionAvatarColor(id: string, color: string) {
  if (!connectionAvatarColors.some((candidate) => candidate === color)) return

  customColors.set(id, color)
  saveColor(id, color)
  try {
    localStorage.setItem(`zap.connectionAvatarChoice.${id}`, color)
  } catch {
    /* Retain the user's choice for this session. */
  }
}

// User choices may repeat; automatic colors fill the least-used remaining slots.
export function assignConnectionAvatarColors(ids: string[]) {
  const saved = new Map(ids.map((id) => [id, readColor(id)]))
  colors.clear()

  for (const id of new Set(ids)) {
    const chosen = customColor(id)
    if (chosen) saveColor(id, chosen)
  }
  for (const id of new Set(ids)) {
    if (!colors.has(id)) saveColor(id, pickAvatarColor(colors.values(), saved.get(id)))
  }
}

export function connectionAvatarColor(id: string): string {
  const saved = customColor(id) ?? readColor(id)
  if (saved) {
    colors.set(id, saved)
    return saved
  }

  const color = pickAvatarColor(colors.values())
  saveColor(id, color)

  return color
}

export function connectionInitial(title: string): string {
  const initial = Array.from(title.trim())[0]

  return initial ? initial.toLocaleUpperCase() : '?'
}
