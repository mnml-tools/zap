import { Database, ArrowUpRight } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { driverNames } from '../../lib/connections'
import { ConnectionEnvironmentBadge } from '../atoms/ConnectionEnvironmentBadge'
import { Spinner } from '../atoms/Spinner'
import { Button } from '../atoms/Button'

type Props = {
  connection: Connection
  active: boolean
  busy: string
  onOpen: (connection: Connection) => void
  onMenu: (connection: Connection, target: HTMLElement, x: number, y: number) => void
}

export function ConnectionRow({ connection: c, active, busy, onOpen, onMenu }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={active ? 'connection context-active' : 'connection'}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu(c, event.currentTarget, event.clientX, event.clientY)
      }}
      onDoubleClick={() => onOpen(c)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          onMenu(c, event.currentTarget, rect.left + 24, rect.bottom)
        } else if (event.key === 'Enter') onOpen(c)
      }}
    >
      <div className="db-icon">
        <Database size={22} />
      </div>
      <div className="connection-info">
        <h3>{c.title}</h3>
        <p>{c.driver === 'sqlite' ? c.database : `${c.host}:${c.port} / ${c.database}`}</p>
      </div>
      <ConnectionEnvironmentBadge environment={c.environment} />
      <span className="badge">{driverNames[c.driver]}</span>
      <Button aria-label={`Open ${c.title}`} onClick={() => onOpen(c)} disabled={!!busy}>
        {busy === c.id ? <Spinner size={17} /> : <ArrowUpRight size={18} />}
      </Button>
    </div>
  )
}
