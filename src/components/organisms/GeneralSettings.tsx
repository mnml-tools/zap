import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Dialog } from '@mnml-tools/ui'
import { Palette, Keyboard, Table2, Code2 } from 'lucide-react'
import { EditorSettings } from './EditorSettings'
import { DataSettings } from './DataSettings'
import { ThemeSettings } from './ThemeSettings'
import { ShortcutSettings } from './ShortcutSettings'

export function GeneralSettings({ onDismiss }: { onDismiss: () => void }) {
  const [section, setSection] = useState<'themes' | 'shortcuts' | 'data' | 'editor'>('themes')

  return createPortal(
    <Dialog title="General settings" className="settings-dialog" closeLabel="Close settings" onDismiss={onDismiss}>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          <Button aria-current={section === 'themes' ? 'page' : undefined} onClick={() => setSection('themes')}>
            <Palette size={15} />
            Themes
          </Button>
          <Button aria-current={section === 'shortcuts' ? 'page' : undefined} onClick={() => setSection('shortcuts')}>
            <Keyboard size={15} />
            Shortcuts
          </Button>
          <Button aria-current={section === 'data' ? 'page' : undefined} onClick={() => setSection('data')}>
            <Table2 size={15} />
            Data &amp; tables
          </Button>
          <Button aria-current={section === 'editor' ? 'page' : undefined} onClick={() => setSection('editor')}>
            <Code2 size={15} />
            SQL editor
          </Button>
        </nav>
        <div className="settings-content">
          {section === 'themes' ? (
            <ThemeSettings />
          ) : section === 'data' ? (
            <DataSettings />
          ) : section === 'editor' ? (
            <EditorSettings />
          ) : (
            <ShortcutSettings />
          )}
        </div>
        <div className="mnml-dialog-actions settings-actions">
          <Button onClick={onDismiss}>Done</Button>
        </div>
      </div>
    </Dialog>,
    document.body
  )
}
