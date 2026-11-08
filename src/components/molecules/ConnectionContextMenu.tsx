import { Pencil, Trash2 } from 'lucide-react'
import type { Connection } from '../../types/connection'
import { ContextMenu } from '@mnml-tools/ui'

type Props = {
  connection: Connection
  x: number
  y: number
  onDismiss: () => void
  onEdit: () => void
  onRemove: () => void
}

export function ConnectionContextMenu({ connection, x, y, onDismiss, onEdit, onRemove }: Props) {
  return (
    <ContextMenu
      label={`Actions for ${connection.title}`}
      x={x}
      y={y}
      onDismiss={onDismiss}
      items={[
        { label: 'Edit connection', icon: <Pencil size={13} />, onSelect: onEdit },
        { label: 'Remove connection', icon: <Trash2 size={13} />, onSelect: onRemove }
      ]}
    />
  )
}
