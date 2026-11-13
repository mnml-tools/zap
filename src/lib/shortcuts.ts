import type { Shortcut } from '@mnml-tools/ui'

export { formatShortcut, matchesShortcut } from '@mnml-tools/ui'

export type { Shortcut } from '@mnml-tools/ui'

export const duplicateRowsShortcut: Shortcut = { key: 'd', primary: true }

export const removeRowsShortcut: Shortcut = { key: 'Backspace', primary: true }

export const discardChangesShortcut: Shortcut = { key: 'z', primary: true }

export const saveChangesShortcut: Shortcut = { key: 's', primary: true, allowInInputs: true }

export const switchConnectionShortcut: Shortcut = { key: 'p', primary: true, allowInInputs: true }

export const goToShortcut: Shortcut = { key: 'n', primary: true, allowInInputs: true }

export const closeAllTabsShortcut: Shortcut = { key: 'w', primary: true, shift: true, allowInInputs: true }

export const runQueryShortcut: Shortcut = { key: 'Enter', primary: true, allowInInputs: true }

export const formatQueryShortcut: Shortcut = { key: 'l', alt: true, shift: true }

type KeyPress = { code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }

// Matched by physical key because Option changes `event.key` on macOS (Option+Shift+L types "Ò").
export const isFormatQueryShortcut = (event: KeyPress) =>
  event.code === 'KeyL' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
