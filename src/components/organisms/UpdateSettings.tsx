import { useContext, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { Button, Spinner } from '@mnml-tools/ui'
import { version } from '../../../package.json'
import { api } from '../../services/api'
import { Updates } from '../../services/updates'
import { updatePreferences } from '../../services/updatePreferences'
import { usePreferences } from '../../hooks/usePreferences'
import { SettingsField } from '../molecules/SettingsField'

export function UpdateSettings({ onDismiss }: { onDismiss: () => void }) {
  const updates = useContext(Updates)
  const { values, update, error } = usePreferences(updatePreferences)
  const [linkError, setLinkError] = useState('')

  const open = async (page: 'releases' | 'project' | 'issues') => {
    setLinkError('')

    try {
      if (isTauri())
        await api(
          page === 'releases' ? 'open_latest_release' : 'open_project_page',
          page === 'releases' ? undefined : { page }
        )
      else
        window.open(
          `https://github.com/mnml-tools/zap${page === 'releases' ? '/releases/latest' : page === 'issues' ? '/issues' : ''}`,
          '_blank',
          'noopener,noreferrer'
        )
    } catch (error) {
      setLinkError(String(error))
    }
  }

  return (
    <section className="settings-section" aria-labelledby="updates-settings-title">
      <div>
        <h2 id="updates-settings-title">Updates &amp; about</h2>
        <p>Keep Zap up to date and find project information.</p>
      </div>
      <div className="settings-about-version">
        <strong>Zap</strong>
        <span>Version {version}</span>
        <span>PostgreSQL · MySQL · SQLite</span>
      </div>
      <SettingsField
        title="Check for updates on startup"
        description="Checks when Zap launches. Downloads and installation still require your action."
      >
        <input
          type="checkbox"
          checked={values.automatic}
          onChange={(event) => update({ automatic: event.target.checked })}
        />
      </SettingsField>
      <div className="settings-update-check">
        <Button
          disabled={!updates?.supported || updates.checking}
          onClick={async () => {
            if (await updates?.checkForUpdates()) onDismiss()
          }}
        >
          {updates?.checking && <Spinner size={13} />}
          {updates?.checking ? 'Checking…' : 'Check for updates'}
        </Button>
        <p role="status">{!updates?.supported ? 'Update checks are available in the desktop app.' : updates.message}</p>
      </div>
      {(error || updates?.error || linkError) && <p role="alert">{error || updates?.error || linkError}</p>}
      <div className="settings-project-links">
        <Button onClick={() => void open('releases')}>Release notes</Button>
        <Button onClick={() => void open('project')}>Project on GitHub</Button>
        <Button onClick={() => void open('issues')}>Report an issue</Button>
      </div>
    </section>
  )
}
