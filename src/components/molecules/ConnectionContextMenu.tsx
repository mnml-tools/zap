import { Pencil, Trash2 } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { useContextMenu } from '../../hooks/useContextMenu'
import { Button } from '../atoms/Button'

export function ConnectionContextMenu({
  connection,
  x,
  y,
  onDismiss,
  onEdit,
  onRemove
}: {
  connection: Connection
  x: number
  y: number
  onDismiss: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const menu = useContextMenu(onDismiss)

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`Actions for ${connection.title}`}
      className="connection-menu"
      style={{
        left: Math.max(4, Math.min(x, window.innerWidth - 194)),
        top: Math.max(4, Math.min(y, window.innerHeight - 70))
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Button role="menuitem" onClick={onEdit}>
        <Pencil size={13} />
        Edit connection
      </Button>
      <Button role="menuitem" onClick={onRemove}>
        <Trash2 size={13} />
        Remove connection
      </Button>
    </div>
  )
}
