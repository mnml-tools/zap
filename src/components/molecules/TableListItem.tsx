import type { MouseEventHandler } from 'react'
import type { Table } from '../../types/table'
import { Button } from '../atoms/Button'
import { DirtyIndicator } from '../atoms/DirtyIndicator'
import { TableIcon } from '../atoms/TableIcon'

type Props = {
  table: Table
  active: boolean
  dirty: boolean
  disabled: boolean
  onContextMenu: MouseEventHandler<HTMLButtonElement>
  onOpen: (table: Table) => void
}

export function TableListItem({ table, active, dirty, disabled, onOpen, onContextMenu }: Props) {
  return (
    <Button
      disabled={disabled}
      className={active ? 'active' : ''}
      onClick={() => onOpen(table)}
      onContextMenu={onContextMenu}
    >
      <TableIcon table={table} size={15} />
      <span>{table.name}</span>
      {dirty && <DirtyIndicator />}
      {table.schema && table.schema !== 'public' && <small>{table.schema}</small>}
    </Button>
  )
}
