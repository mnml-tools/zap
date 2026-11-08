import { ConnectionAvatarPicker } from './ConnectionAvatarPicker'
import type { Connection } from '../../types/connection'
import { SshConnectionFields } from './SshConnectionFields'
import { ConnectionEnvironmentPicker } from './ConnectionEnvironmentPicker'
import { SqliteFilePicker } from './SqliteFilePicker'
import { Fields } from '@mnml-tools/ui'

type Props = {
  connection: Connection
  editing: boolean
  onChange: (connection: Connection, resetTest?: boolean) => void
}

export function ConnectionFields({ connection: form, editing, onChange }: Props) {
  return (
    <Fields>
      <label className="mnml-field-full">
        Connection name
        <input
          required
          data-autofocus
          placeholder="e.g. Production, side project…"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value }, false)}
        />
      </label>
      <ConnectionAvatarPicker connection={form} onChange={(avatarColor) => onChange({ ...form, avatarColor }, false)} />
      <ConnectionEnvironmentPicker
        value={form.environment}
        onChange={(environment) => onChange({ ...form, environment }, false)}
      />
      {form.driver !== 'sqlite' && (
        <>
          <label className="host">
            {form.ssh ? 'Database host as seen from SSH server' : 'Host'}
            <input required value={form.host} onChange={(event) => onChange({ ...form, host: event.target.value })} />
          </label>
          <label>
            Port
            <input
              required
              type="number"
              min="1"
              max="65535"
              value={form.port}
              onChange={(event) => onChange({ ...form, port: Number(event.target.value) })}
            />
          </label>
          <label className="mnml-field-full">
            Authentication
            <select
              value={form.authentication}
              onChange={(event) => onChange({ ...form, authentication: event.target.value })}
            >
              <option value="password">User &amp; password</option>
              <option value="none">User only / no password</option>
            </select>
          </label>
          <label>
            User
            <input required value={form.user} onChange={(event) => onChange({ ...form, user: event.target.value })} />
          </label>
          <label>
            Password
            <input
              type="password"
              disabled={form.authentication === 'none'}
              value={form.password}
              onChange={(event) => onChange({ ...form, password: event.target.value })}
              placeholder={editing ? 'Leave blank to keep saved password' : '••••••••'}
            />
          </label>
        </>
      )}
      {form.driver === 'sqlite' ? (
        <SqliteFilePicker path={form.database} onChange={(database) => onChange({ ...form, database })} />
      ) : (
        <label className="mnml-field-full">
          Database name
          <input
            required
            placeholder="my_database"
            value={form.database}
            onChange={(event) => onChange({ ...form, database: event.target.value })}
          />
        </label>
      )}
      {(form.driver === 'postgresql' || form.driver === 'mysql') && (
        <SshConnectionFields settings={form.ssh} onChange={(ssh) => onChange({ ...form, ssh })} />
      )}
    </Fields>
  )
}
