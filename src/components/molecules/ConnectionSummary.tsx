import { ConnectionAvatar } from '../atoms/ConnectionAvatar'
import type { Connection } from '../../types/connection'
import { driverNames } from '../../lib/connections'

export function ConnectionSummary({ connection }: { connection: Connection }) {
  const driver = driverNames[connection.driver] ?? connection.driver

  return (
    <div className="header-connection" title={`${connection.title} · ${driver}`}>
      <ConnectionAvatar connection={connection} size="small" />
      <strong>{connection.title}</strong>
      <span className="connection-driver">{driver}</span>
    </div>
  )
}
