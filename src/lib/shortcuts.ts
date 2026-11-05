export type Shortcut = {
  key: string
  primary?: boolean
  shift?: boolean
  alt?: boolean
}

export const duplicateRowsShortcut: Shortcut = { key: 'd', primary: true }

export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut, mac: boolean) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    event.metaKey === (mac && !!shortcut.primary) &&
    event.ctrlKey === (!mac && !!shortcut.primary) &&
    event.shiftKey === !!shortcut.shift &&
    event.altKey === !!shortcut.alt
  )
}

export function formatShortcut(shortcut: Shortcut, mac = /Mac/.test(navigator.platform)) {
  const modifiers = [
    shortcut.primary ? (mac ? '⌘' : 'Ctrl') : '',
    shortcut.alt ? (mac ? '⌥' : 'Alt') : '',
    shortcut.shift ? (mac ? '⇧' : 'Shift') : ''
  ].filter(Boolean)

  return [...modifiers, shortcut.key.toUpperCase()].join(mac ? '' : '+')
}
