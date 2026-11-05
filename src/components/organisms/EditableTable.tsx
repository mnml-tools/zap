import type { ComponentProps } from 'react'
import type { Page, TableDraft, TableSort, CellEditor } from '../../types/table'
import { useTableNavigation } from '../../hooks/useTableNavigation'
import { useColumnSelection } from '../../hooks/useColumnSelection'
import { ActionContextMenu } from '../molecules/ActionContextMenu'
import { ErrorDialog } from '../molecules/ErrorDialog'
import { rowKey } from '../../lib/tableState'
import { ColumnHeader } from '../molecules/ColumnHeader'
import { EditableTableRow } from '../molecules/EditableTableRow'
import { NewTableRow } from '../molecules/NewTableRow'

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
  onBeginBlank: (column: number) => void
  onBeginNew: (key: string, column: number) => void
  onRemoveNew: (key: string) => void
  onDuplicateRows: (rows: (string | null)[][]) => void
  onRemoveRows: (rows: (string | null)[][]) => void
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
  onRemoveRows,
  onDuplicateRows,
  onBeginNew,
  onBeginBlank,
  onRemoveNew,
  ...actions
}: Props) {
  const selection = useColumnSelection(data, draft)
  const newRows = Object.entries(draft?.rows ?? {}).filter(([, row]) => row.inserted)
  const navigate = useTableNavigation({
    disabled: saving,
    onSelect: (row, columnIndex) => {
      const column = visibleColumns[columnIndex]
      selection.selectCell(column, row)

      if (row < data.rows.length) actions.onBegin(data.rows[row], column)
      else if (row < data.rows.length + newRows.length) onBeginNew(newRows[row - data.rows.length][0], column)
      else onBeginBlank(column)
    }
  })
  const { menu } = selection
  const menuRows =
    menu?.row === undefined
      ? []
      : data.rows.slice(Math.min(menu.range.anchor, menu.range.end), Math.max(menu.range.anchor, menu.range.end) + 1)
  const restoreRows = menuRows.every((row) => draft?.rows[rowKey(row, data)]?.deleted)
  const rowLabel = menuRows.length === 1 ? 'Row' : `${menuRows.length} Rows`

  return (
    <>
      <table
        className="selectable-table"
        onKeyDown={(event) => {
          navigate(event)

          if (event.defaultPrevented) return

          if (
            event.key.toLowerCase() !== 'd' ||
            !(event.metaKey || event.ctrlKey) ||
            event.altKey ||
            event.shiftKey ||
            (event.target instanceof HTMLElement &&
              (event.target.isContentEditable || !!event.target.closest('input, textarea, select'))) ||
            !selection.selectedRows.length
          )
            return

          event.preventDefault()
          event.stopPropagation()

          if (!event.repeat && !saving && !data.readOnlyReason) onDuplicateRows(selection.selectedRows)
        }}
      >
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
          {newRows.map(([key, row]) => (
            <NewTableRow
              key={key}
              draft={row}
              data={data}
              visibleColumns={visibleColumns}
              editor={editor?.tab === active && editor.rowKey === key ? editor : null}
              saving={saving}
              onBegin={(column) => onBeginNew(key, column)}
              onRemove={() => onRemoveNew(key)}
              onValueChange={actions.onValueChange}
              onCommit={actions.onCommit}
              onCancel={actions.onCancel}
              onNull={actions.onNull}
            />
          ))}
          <NewTableRow
            key="blank-row"
            placeholder
            draft={{ original: data.columns.map(() => null), changes: {} }}
            data={data}
            visibleColumns={visibleColumns}
            editor={null}
            saving={saving || !!data.readOnlyReason}
            onBegin={onBeginBlank}
            onRemove={() => {}}
            onValueChange={actions.onValueChange}
            onCommit={actions.onCommit}
            onCancel={actions.onCancel}
            onNull={actions.onNull}
          />
        </tbody>
      </table>
      {menu && (
        <ActionContextMenu
          title={data.columns[menu.range.column]}
          x={menu.x}
          y={menu.y}
          trigger={menu.trigger}
          onDismiss={selection.dismissMenu}
          actions={[
            ...(menu.range.mode === 'cells'
              ? [{ label: 'Copy All Column Values', disabled: !data.rows.length, run: selection.copy }]
              : []),
            ...(menuRows.length
              ? [
                  {
                    label: `${restoreRows ? 'Restore' : 'Remove'} ${rowLabel}`,
                    disabled:
                      saving ||
                      !!data.readOnlyReason ||
                      !data.primaryKeys.length ||
                      menuRows.some((row) => data.primaryKeys.some((index) => row[index] === null)),
                    run: () => {
                      onRemoveRows(menuRows)
                      selection.dismissMenu()
                    }
                  }
                ]
              : [])
          ]}
        />
      )}
      {selection.error && (
        <ErrorDialog title="Clipboard error" message={selection.error} onDismiss={selection.dismissError} />
      )}
    </>
  )
}
