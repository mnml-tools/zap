import { Button } from '@mnml-tools/ui'
import { usePreferences } from '../../hooks/usePreferences'
import { editorPreferences } from '../../services/editorPreferences'
import { SettingsField } from '../molecules/SettingsField'

export function EditorSettings() {
  const { values, update, reset, error } = usePreferences(editorPreferences)

  return (
    <section className="settings-section" aria-labelledby="editor-settings-title">
      <div>
        <h2 id="editor-settings-title">SQL editor</h2>
        <p>Adjust the editor to your workflow.</p>
      </div>
      <div className="settings-fields">
        <SettingsField title="Font size" description="Applies to SQL text and line numbers.">
          <select
            aria-label="Editor font size"
            value={values.fontSize}
            onChange={(event) => update({ fontSize: Number(event.target.value) })}
          >
            {[11, 12, 13, 14, 16, 18].map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </SettingsField>
        <SettingsField title="Indentation" description="Spaces inserted when pressing Tab.">
          <select
            aria-label="Indentation"
            value={values.indentSize}
            onChange={(event) => update({ indentSize: Number(event.target.value) })}
          >
            {[2, 4, 8].map((size) => (
              <option key={size} value={size}>
                {size} spaces
              </option>
            ))}
          </select>
        </SettingsField>
        <SettingsField
          title="Automatic suggestions"
          description="Show completions while typing. Ctrl+Space always opens suggestions."
        >
          <input
            type="checkbox"
            checked={values.autoComplete}
            onChange={(event) => update({ autoComplete: event.target.checked })}
          />
        </SettingsField>
        <SettingsField
          title="Confirm queries that make changes"
          description="Ask before running SQL containing data or schema changes, including INSERT, UPDATE, DELETE, and DROP."
        >
          <input
            type="checkbox"
            checked={values.confirmChanges}
            onChange={(event) => update({ confirmChanges: event.target.checked })}
          />
        </SettingsField>
      </div>
      {error && <p role="alert">{error}</p>}
      <div>
        <Button onClick={reset}>Reset editor defaults</Button>
      </div>
    </section>
  )
}
