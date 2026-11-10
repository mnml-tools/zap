import type { Shortcut } from '@mnml-tools/ui'

export { formatShortcut, matchesShortcut } from '@mnml-tools/ui'

export type { Shortcut } from '@mnml-tools/ui'

export const duplicateRowsShortcut: Shortcut = { key: 'd', primary: true }

export const removeRowsShortcut: Shortcut = { key: 'Backspace', primary: true }

export const discardChangesShortcut: Shortcut = { key: 'z', primary: true }

export const saveChangesShortcut: Shortcut = { key: 's', primary: true, allowInInputs: true }

export const switchConnectionShortcut: Shortcut = { key: 'p', primary: true, allowInInputs: true }

export const goToShortcut: Shortcut = { key: 'n', primary: true, allowInInputs: true }

export const runQueryShortcut: Shortcut = { key: 'Enter', primary: true, allowInInputs: true }
