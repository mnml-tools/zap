import { Button } from '@mnml-tools/ui'
import { usePreferences } from '../../hooks/usePreferences'
import { dataPreferences, pageSizeOptions, type DataPreferences } from '../../services/dataPreferences'
import { SettingsField } from '../molecules/SettingsField'

export function DataSettings() {
  const { values, update, reset, error } = usePreferences(dataPreferences)

  return (
    <section className="settings-section" aria-labelledby="data-settings-title">
      <div>
        <h2 id="data-settings-title">Data &amp; tables</h2>
        <p>Set defaults for browsing table data and query results.</p>
      </div>
      <div className="settings-fields">
        <SettingsField
          title="Default page size"
          description="Used for newly opened tables. Existing tabs keep their page size."
        >
          <select
            aria-label="Default page size"
            value={values.pageSize}
            onChange={(event) => update({ pageSize: Number(event.target.value) })}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </SettingsField>
        <SettingsField title="NULL values" description="How empty database values appear in tables and results.">
          <select
            aria-label="NULL values"
            value={values.nullLabel}
            onChange={(event) => update({ nullLabel: event.target.value as DataPreferences['nullLabel'] })}
          >
            {['NULL', '—', '(null)'].map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </SettingsField>
        <SettingsField title="Wrap cell text" description="Show long values on multiple lines.">
          <input
            type="checkbox"
            checked={values.wrapText}
            onChange={(event) => update({ wrapText: event.target.checked })}
          />
        </SettingsField>
        <SettingsField title="Row density" description="Adjust the spacing in data tables and query results.">
          <select
            aria-label="Row density"
            value={values.density}
            onChange={(event) => update({ density: event.target.value as DataPreferences['density'] })}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </SettingsField>
      </div>
      {error && <p role="alert">{error}</p>}
      <div>
        <Button onClick={reset}>Reset data defaults</Button>
      </div>
    </section>
  )
}
