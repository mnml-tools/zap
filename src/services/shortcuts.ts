import type { Shortcut } from '@mnml-tools/ui'
import {
  duplicateRowsShortcut,
  removeRowsShortcut,
  discardChangesShortcut,
  saveChangesShortcut,
  switchConnectionShortcut,
  goToShortcut,
  runQueryShortcut
} from '../lib/shortcuts.ts'

export const shortcutCommands = [
  { id: 'goTo', label: 'Go to table or query', shortcut: goToShortcut },
  { id: 'switchConnection', label: 'Switch connection', shortcut: switchConnectionShortcut },
  { id: 'runQuery', label: 'Run query', shortcut: runQueryShortcut },
  { id: 'saveChanges', label: 'Save changes', shortcut: saveChangesShortcut },
  { id: 'discardChanges', label: 'Discard changes', shortcut: discardChangesShortcut },
  { id: 'duplicateRows', label: 'Duplicate selected rows', shortcut: duplicateRowsShortcut },
  { id: 'removeRows', label: 'Remove selected rows', shortcut: removeRowsShortcut }
] as const

export type ShortcutId = (typeof shortcutCommands)[number]['id']
type Overrides = Partial<Record<ShortcutId, Shortcut>>

const storageKey = 'zap.shortcuts'
const listeners = new Set<() => void>()
let overrides: Overrides = {}

try {
  const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}')

  for (const command of shortcutCommands) {
    const value = stored?.[command.id]

    if (
      value &&
      typeof value.key === 'string' &&
      value.key.length > 0 &&
      typeof value.primary === 'boolean' &&
      typeof value.shift === 'boolean' &&
      typeof value.alt === 'boolean'
    ) {
      overrides[command.id] = {
        ...command.shortcut,
        key: value.key,
        primary: value.primary,
        shift: value.shift,
        alt: value.alt
      }
    }
  }
} catch {
  // Missing or invalid preferences fall back to the defaults.
}

export const getShortcuts = () => overrides

export function subscribeShortcuts(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function resolveShortcut(shortcut: Shortcut) {
  const command = shortcutCommands.find((item) => item.shortcut === shortcut)

  return (command && overrides[command.id]) || shortcut
}

export function shortcutConflict(id: ShortcutId, shortcut: Shortcut) {
  return shortcutCommands.find((command) => {
    const current = resolveShortcut(command.shortcut)

    return (
      command.id !== id &&
      current.key.toLowerCase() === shortcut.key.toLowerCase() &&
      !!current.primary === !!shortcut.primary &&
      !!current.shift === !!shortcut.shift &&
      !!current.alt === !!shortcut.alt
    )
  })
}

export function saveShortcut(id: ShortcutId, shortcut?: Shortcut) {
  const next = { ...overrides }

  if (shortcut) next[id] = shortcut
  else delete next[id]

  localStorage.setItem(storageKey, JSON.stringify(next))
  overrides = next
  listeners.forEach((listener) => listener())
}

export function resetShortcuts() {
  localStorage.removeItem(storageKey)
  overrides = {}
  listeners.forEach((listener) => listener())
}
