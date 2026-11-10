import { useState } from 'react'
import { Button, formatShortcut } from '@mnml-tools/ui'
import { macPlatform } from '../../lib/platform'
import { shortcutPreview } from '../../lib/shortcutPreview'
import { useShortcutPreferences } from '../../hooks/useAppShortcut'
import { resolveShortcut, saveShortcut, shortcutConflict, type shortcutCommands } from '../../services/shortcuts'

type Props = { command: (typeof shortcutCommands)[number] }

export function ShortcutSetting({ command }: Props) {
  const overrides = useShortcutPreferences()
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')

  return (
    <div className="settings-shortcut-row">
      <span id={`shortcut-${command.id}`}>{command.label}</span>
      <Button
        aria-labelledby={`shortcut-${command.id}`}
        aria-pressed={recording}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          setRecording(true)
          setPreview('')
          setError('')
        }}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          if (!recording) return

          if (event.key === 'Tab') {
            setRecording(false)
            return
          }

          event.preventDefault()
          event.stopPropagation()
          setPreview(shortcutPreview(event, macPlatform))

          if (event.key === 'Escape') {
            setRecording(false)
            setError('')
            return
          }
          if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return

          const primary = macPlatform ? event.metaKey : event.ctrlKey

          if (!primary || (macPlatform ? event.ctrlKey : event.metaKey)) {
            setError(`Use ${macPlatform ? 'Command' : 'Ctrl'} with a key, optionally Shift or Alt.`)
            return
          }

          const shortcut = {
            ...command.shortcut,
            key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
            primary,
            shift: event.shiftKey,
            alt: event.altKey
          }
          const conflict = shortcutConflict(command.id, shortcut)

          if (conflict) {
            setError(`Already used by “${conflict.label}”.`)
            return
          }

          try {
            saveShortcut(command.id, shortcut)
            setRecording(false)
            setError('')
          } catch {
            setError('Could not save this shortcut. Please try again.')
          }
        }}
        onKeyUp={(event) => {
          if (!recording) return

          setPreview(shortcutPreview(event, macPlatform, true))
        }}
      >
        {recording ? preview || 'Press shortcut…' : formatShortcut(resolveShortcut(command.shortcut))}
      </Button>
      <Button
        disabled={!overrides[command.id]}
        aria-label={`Reset ${command.label} shortcut`}
        onClick={() => {
          const conflict = shortcutConflict(command.id, command.shortcut)

          if (conflict) {
            setError(`Default is used by “${conflict.label}”. Reset all shortcuts to restore it.`)
            return
          }

          try {
            saveShortcut(command.id)
            setError('')
          } catch {
            setError('Could not reset this shortcut. Please try again.')
          }
        }}
      >
        Reset
      </Button>
      {error && (
        <p className="settings-shortcut-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
