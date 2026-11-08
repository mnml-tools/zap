import type { MouseEventHandler } from 'react'
import type { Table } from '../../types/table'
import { DirtyIndicator, SidebarItem } from '@mnml-tools/ui'
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
    <SidebarItem disabled={disabled} active={active} onClick={() => onOpen(table)} onContextMenu={onContextMenu}>
      <TableIcon table={table} size={15} />
      <span>{table.name}</span>
      {dirty && <DirtyIndicator />}
      {table.schema && table.schema !== 'public' && <small>{table.schema}</small>}
    </SidebarItem>
  )
}
