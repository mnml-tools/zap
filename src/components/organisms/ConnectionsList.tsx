import type { ComponentProps } from 'react'
import type { ConnectionView } from '../../hooks/useConnectionView'
import type { Connection } from '../../types/connection'
import { matchesConnection } from '../../lib/connections'
import { ConnectionRow } from '../molecules/ConnectionRow'

type Props = { connections: Connection[]; search: string; activeId?: string; view?: ConnectionView } & Pick<
  ComponentProps<typeof ConnectionRow>,
  'busy' | 'onOpen' | 'onMenu'
>

export function ConnectionsList({ connections, search, activeId, view = 'cards', ...actions }: Props) {
  const filtered = connections.filter((connection) => matchesConnection(connection, search))

  return (
    <div className={`connections connections-${view}`} aria-label="Saved connections">
      {filtered.map((connection) => (
        <ConnectionRow key={connection.id} connection={connection} active={activeId === connection.id} {...actions} />
      ))}
      {search && !filtered.length && <p className="no-results">No connections match “{search}”.</p>}
    </div>
  )
}
