import { useCallback, useState } from 'react'
import type { Table, TableDraft } from '../../types/table'
import { tableKey, countChanges, isView } from '../../lib/tableState'
import { ActionContextMenu } from '../molecules/ActionContextMenu'
import { TableListItem } from '../molecules/TableListItem'

type Props = {
  tables: Table[]
  search: string
  active: string
  pending: Record<string, TableDraft>
  disabled: boolean
  onCopy: (table: Table) => void
  onExport: (table: Table) => void
  onDelete: (table: Table) => void
  onOpen: (table: Table) => void
}

export function TableList({ tables, search, active, pending, disabled, onOpen, onCopy, onExport, onDelete }: Props) {
  const [menu, setMenu] = useState<{ table: Table; x: number; y: number }>()
  const dismissMenu = useCallback(() => setMenu(undefined), [])
  const views = tables.filter(isView)

  const items = (list: Table[]) =>
    list
      .filter((table) => `${table.schema}.${table.name}`.toLowerCase().includes(search.toLowerCase()))
      .map((table) => (
        <TableListItem
          key={tableKey(table)}
          table={table}
          active={active === tableKey(table)}
          dirty={countChanges(pending[tableKey(table)]) > 0}
          disabled={disabled}
          onOpen={onOpen}
          onContextMenu={(event) => {
            event.preventDefault()
            if (disabled) return

            const rect = event.currentTarget.getBoundingClientRect()
            setMenu({ table, x: event.clientX || rect.left, y: event.clientY || rect.bottom })
          }}
        />
      ))

  // Views are read-only here, so they only offer actions that cannot change the database.
  const actions = (table: Table) =>
    isView(table)
      ? [{ label: 'Copy view name', action: onCopy }]
      : [
          { label: 'Copy table name', action: onCopy },
          { label: 'Export table as .sql file', action: onExport },
          { label: 'Delete table', action: onDelete }
        ]

  return (
    <nav>
      {items(tables.filter((table) => !isView(table)))}
      {views.length > 0 && (
        <>
          <div className="sidebar-label sidebar-section-label">
            VIEWS <span>{views.length}</span>
          </div>
          {items(views)}
        </>
      )}
      {menu && (
        <ActionContextMenu
          key={tableKey(menu.table)}
          title={menu.table.name}
          x={menu.x}
          y={menu.y}
          onDismiss={dismissMenu}
          actions={actions(menu.table).map(({ label, action }) => ({
            label,
            disabled,
            run: () => {
              dismissMenu()
              action(menu.table)
            }
          }))}
        />
      )}
    </nav>
  )
}
