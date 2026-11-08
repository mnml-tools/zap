import type { SshSettings } from '../../types/connection'

type Props = { settings?: SshSettings | null; onChange: (settings: SshSettings | null) => void }

export function SshConnectionFields({ settings, onChange }: Props) {
  return (
    <>
      <label className="mnml-field-full ssh-toggle">
        <input
          type="checkbox"
          checked={!!settings}
          onChange={(event) => onChange(event.target.checked ? { host: '', port: 22, user: '', keyPath: '' } : null)}
        />
        Connect over SSH
      </label>
      {settings && (
        <>
          <label className="host">
            SSH server
            <input
              required
              value={settings.host}
              onChange={(event) => onChange({ ...settings, host: event.target.value })}
            />
          </label>
          <label>
            SSH port
            <input
              required
              type="number"
              min="1"
              max="65535"
              value={settings.port}
              onChange={(event) => onChange({ ...settings, port: Number(event.target.value) })}
            />
          </label>
          <label className="mnml-field-full">
            SSH user
            <input
              required
              value={settings.user}
              onChange={(event) => onChange({ ...settings, user: event.target.value })}
            />
          </label>
          <label className="mnml-field-full">
            SSH private key path
            <input
              value={settings.keyPath}
              placeholder="Optional · use SSH config or agent"
              onChange={(event) => onChange({ ...settings, keyPath: event.target.value })}
            />
          </label>
        </>
      )}
    </>
  )
}
