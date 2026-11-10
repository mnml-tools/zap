import { useSyncExternalStore } from 'react'
import { formatShortcut, useShortcut, type Shortcut } from '@mnml-tools/ui'
import { getShortcuts, resolveShortcut, subscribeShortcuts } from '../services/shortcuts'

export function useShortcutPreferences() {
  return useSyncExternalStore(subscribeShortcuts, getShortcuts)
}

export function useAppShortcut(shortcut: Shortcut, enabled: boolean, run: () => void) {
  useShortcutPreferences()
  useShortcut(resolveShortcut(shortcut), enabled, run)
}

export function formatAppShortcut(shortcut: Shortcut) {
  return formatShortcut(resolveShortcut(shortcut))
}
