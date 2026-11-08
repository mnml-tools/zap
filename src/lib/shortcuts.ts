import type { Shortcut } from '@mnml-tools/ui'

export { createDoubleShiftDetector, formatShortcut, matchesShortcut } from '@mnml-tools/ui'

export type { Shortcut } from '@mnml-tools/ui'

export const filterTablesShortcut: Shortcut = { key: 'Shift', doubleTap: true, allowInInputs: true }

export const duplicateRowsShortcut: Shortcut = { key: 'd', primary: true }

export const removeRowsShortcut: Shortcut = { key: 'Backspace', primary: true }

export const discardChangesShortcut: Shortcut = { key: 'z', primary: true }

export const saveChangesShortcut: Shortcut = { key: 's', primary: true, allowInInputs: true }

export const switchConnectionShortcut: Shortcut = { key: 'p', primary: true, allowInInputs: true }

export const goToShortcut: Shortcut = { key: 'n', primary: true, allowInInputs: true }
