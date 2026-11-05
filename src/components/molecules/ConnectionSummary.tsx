import { Database, HardDrive, Server } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { driverNames } from '../../lib/connections'

const driverIcons = { postgresql: Database, mysql: Server, sqlite: HardDrive }

export function ConnectionSummary({ connection }: { connection: Connection }) {
  const driver = driverNames[connection.driver] ?? connection.driver
  const Icon = driverIcons[connection.driver as keyof typeof driverIcons] ?? Database

  return (
    <div className="header-connection" title={`${connection.title} · ${driver}`}>
      <Icon size={14} aria-hidden="true" />
      <strong>{connection.title}</strong>
      <span className="connection-driver">{driver}</span>
    </div>
  )
}
