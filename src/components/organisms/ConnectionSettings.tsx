import { useContext } from 'react'
import { Button } from '@mnml-tools/ui'
import { usePreferences } from '../../hooks/usePreferences'
import { connectionPreferences, type ConnectionPreferences } from '../../services/connectionPreferences'
import { SavedConnections } from '../../services/savedConnections'
import { orderConnections } from '../../lib/connectionOrder'
import { SettingsField } from '../molecules/SettingsField'

export function ConnectionSettings() {
  const { values, update, reset, error } = usePreferences(connectionPreferences)
  const connections = orderConnections(useContext(SavedConnections))
  const missing = values.startupId && !connections.some((connection) => connection.id === values.startupId)

  return (
    <section className="settings-section" aria-labelledby="connection-settings-title">
      <div>
        <h2 id="connection-settings-title">Connections</h2>
        <p>Choose how Zap starts and organises your saved connections.</p>
      </div>
      <div className="settings-fields">
        <SettingsField title="On startup" description="Applies the next time you launch Zap.">
          <select
            aria-label="On startup"
            value={values.startup}
            onChange={(event) => update({ startup: event.target.value as ConnectionPreferences['startup'] })}
          >
            <option value="last">Reopen last connection</option>
            <option value="picker">Show connections</option>
            <option value="specific">Open a specific connection</option>
          </select>
        </SettingsField>
        {values.startup === 'specific' && (
          <SettingsField title="Startup connection" description="If unavailable, Zap shows the connections screen.">
            <select
              aria-label="Startup connection"
              value={values.startupId}
              onChange={(event) => update({ startupId: event.target.value })}
            >
              <option value="">Choose a connection…</option>
              {missing && <option value={values.startupId}>Unavailable connection</option>}
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.title}
                </option>
              ))}
            </select>
          </SettingsField>
        )}
        <SettingsField title="Connection order" description="Applies to saved connections and the connection switcher.">
          <select
            aria-label="Connection order"
            value={values.order}
            onChange={(event) => update({ order: event.target.value as ConnectionPreferences['order'] })}
          >
            <option value="name">Name</option>
            <option value="environment">Environment, then name</option>
          </select>
        </SettingsField>
      </div>
      {error && <p role="alert">{error}</p>}
      <div>
        <Button onClick={reset}>Reset connection defaults</Button>
      </div>
    </section>
  )
}
