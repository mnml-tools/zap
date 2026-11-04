import type { ComponentProps } from 'react'
import type { Page, TableDraft, TableSort, CellEditor } from '../../types/table'
import { useColumnSelection } from '../../hooks/useColumnSelection'
import { ActionContextMenu } from '../molecules/ActionContextMenu'
import { ErrorDialog } from '../molecules/ErrorDialog'
import { rowKey } from '../../lib/tableState'
import { ColumnHeader } from '../molecules/ColumnHeader'
import { EditableTableRow } from '../molecules/EditableTableRow'

type Props = {
  data: Page
  visibleColumns: number[]
  page: number
  active: string
  draft?: TableDraft
  editor: CellEditor | null
  saving: boolean
  sort?: TableSort
  onSort: (column: string) => void
} & Pick<ComponentProps<typeof EditableTableRow>, 'onBegin' | 'onValueChange' | 'onCommit' | 'onCancel' | 'onNull'>

export function EditableTable({
  data,
  visibleColumns,
  page,
  active,
  draft,
  editor,
  saving,
  sort,
  onSort,
  ...actions
}: Props) {
  const selection = useColumnSelection(data, draft)
  const { menu } = selection

  return (
    <>
      <table className="selectable-table">
        <thead>
          <tr>
            <th className="row-number">#</th>
            {visibleColumns.map((index) => (
              <ColumnHeader
                key={index}
                column={data.columns[index]}
                primary={data.primaryKeys.includes(index)}
                sort={sort}
                disabled={saving}
                onSort={onSort}
                onContextMenu={(event) => selection.openMenu(event, index)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => {
            const key = rowKey(row, data)

            return (
              <EditableTableRow
                key={index}
                row={row}
                rowIndex={index}
                selection={selection}
                rowNumber={page * 100 + index + 1}
                rowKey={key}
                active={active}
                data={data}
                visibleColumns={visibleColumns}
                draft={draft?.rows[key]}
                editor={editor}
                saving={saving}
                {...actions}
              />
            )
          })}
        </tbody>
      </table>
      {menu && (
        <ActionContextMenu
          title={data.columns[menu.range.column]}
          x={menu.x}
          y={menu.y}
          trigger={menu.trigger}
          onDismiss={selection.dismissMenu}
          actions={[{ label: 'Copy All Column Values', disabled: !data.rows.length, run: selection.copy }]}
        />
      )}
      {selection.error && (
        <ErrorDialog title="Clipboard error" message={selection.error} onDismiss={selection.dismissError} />
      )}
    </>
  )
}
