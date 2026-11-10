type KeyPress = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export function shortcutPreview(event: KeyPress, mac: boolean, released = false) {
  const held = (key: string, active: boolean) => active && !(released && event.key === key)
  const parts = [
    held('Control', event.ctrlKey) ? (mac ? '⌃' : 'Ctrl') : '',
    held('Meta', event.metaKey) ? (mac ? '⌘' : 'Meta') : '',
    held('Alt', event.altKey) ? (mac ? '⌥' : 'Alt') : '',
    held('Shift', event.shiftKey) ? (mac ? '⇧' : 'Shift') : ''
  ].filter(Boolean)

  if (!released && !['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) {
    parts.push(event.key === 'Backspace' && mac ? '⌫' : event.key.toUpperCase())
  }

  return parts.join(mac ? '' : '+')
}
