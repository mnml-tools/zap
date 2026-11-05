import { matchesShortcut } from '../lib/shortcuts'
import type { Shortcut } from '../lib/shortcuts'

type Command = {
  shortcut: Shortcut
  enabled: () => boolean
  run: () => void
}

const commands = new Set<Command>()

function handleKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return
  if (
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable || event.target.closest('input, textarea, select, [contenteditable]'))
  )
    return
  if (document.querySelector('dialog[open], [aria-modal="true"]')) return

  const mac = /Mac/.test(navigator.platform)
  const command = [...commands].reverse().find((item) => item.enabled() && matchesShortcut(event, item.shortcut, mac))
  if (!command) return

  event.preventDefault()
  if (!event.repeat) command.run()
}

export function registerShortcut(command: Command) {
  if (!commands.size) document.addEventListener('keydown', handleKeyDown)
  commands.add(command)

  return () => {
    commands.delete(command)
    if (!commands.size) document.removeEventListener('keydown', handleKeyDown)
  }
}
