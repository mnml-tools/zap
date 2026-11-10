import { useState } from 'react'
import { Button } from '@mnml-tools/ui'
import { resetShortcuts, shortcutCommands } from '../../services/shortcuts'
import { ShortcutSetting } from '../molecules/ShortcutSetting'

export function ShortcutSettings() {
  const [error, setError] = useState('')

  return (
    <section className="settings-section" aria-labelledby="shortcut-settings-title">
      <div>
        <h2 id="shortcut-settings-title">Shortcuts</h2>
        <p>Click a shortcut, then press a new combination. Press Escape to cancel.</p>
      </div>
      <div>
        {shortcutCommands.map((command) => (
          <ShortcutSetting key={command.id} command={command} />
        ))}
      </div>
      <p>Tab, Shift+Tab, and Ctrl+Tab keep their standard navigation behaviour.</p>
      <div>
        <Button
          onClick={() => {
            try {
              resetShortcuts()
              setError('')
            } catch {
              setError('Could not reset shortcuts. Please try again.')
            }
          }}
        >
          Reset all shortcuts
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
