import { useState } from 'react'
import type { ComponentProps } from 'react'
import { useConnectionOrder } from '../../hooks/useConnectionOrder'
import type { ConnectionView } from '../../hooks/useConnectionView'
import type { Connection } from '../../types/connection'
import { matchesConnection } from '../../lib/connections'
import { ConnectionRow } from '../molecules/ConnectionRow'

type Props = { connections: Connection[]; search: string; activeId?: string; view?: ConnectionView } & Pick<
  ComponentProps<typeof ConnectionRow>,
  'busy' | 'onOpen' | 'onMenu'
>

export function ConnectionsList({ connections, search, activeId, view = 'grid', ...actions }: Props) {
  const { ordered, move } = useConnectionOrder(connections)
  const [dragging, setDragging] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const filtered = ordered.filter((connection) => matchesConnection(connection, search))

  return (
    <div className={`connections connections-${view}`} aria-label="Saved connections">
      {filtered.map((connection) => (
        <ConnectionRow
          key={connection.id}
          connection={connection}
          active={activeId === connection.id}
          {...actions}
          reorder={{
            dragging: dragging === connection.id,
            target: target === connection.id && dragging !== connection.id,
            onDragStart: (event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', connection.id)
              setDragging(connection.id)
            },
            onDragOver: (event) => {
              if (!dragging || actions.busy) return

              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setTarget(connection.id)
            },
            onDrop: (event) => {
              if (!dragging || actions.busy) return

              event.preventDefault()
              move(dragging, connection.id)
              setDragging(null)
              setTarget(null)
            },
            onDragEnd: () => {
              setDragging(null)
              setTarget(null)
            },
            onMove: (direction) => {
              const index = filtered.findIndex((item) => item.id === connection.id)
              const neighbor = filtered[index + direction]
              if (neighbor) move(connection.id, neighbor.id)
            }
          }}
        />
      ))}
      {search && !filtered.length && <p className="no-results">No connections match “{search}”.</p>}
    </div>
  )
}
