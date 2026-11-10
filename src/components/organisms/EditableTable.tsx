import { formatAppShortcut } from '../../hooks/useAppShortcut'
import { useAppShortcut } from '../../hooks/useAppShortcut'
import type { ComponentProps } from 'react'
import type { Page, TableDraft, TableSort, CellEditor } from '../../types/table'
import { duplicateRowsShortcut, removeRowsShortcut } from '../../lib/shortcuts'
import { useTableNavigation } from '../../hooks/useTableNavigation'
import { useColumnSelection } from '../../hooks/useColumnSelection'
import { rowKey } from '../../lib/tableState'
import { foreignKeyFor, referenceTitle } from '../../lib/relations'
import { ColumnHeader } from '../molecules/ColumnHeader'
import { EditableTableRow } from '../molecules/EditableTableRow'
import { NewTableRow } from '../molecules/NewTableRow'
import { ContextMenu, ErrorDialog } from '@mnml-tools/ui'

type Props = {
  data: Page
  visibleColumns: number[]
  pageSize: number
  page: number
  active: string
  draft?: TableDraft
  editor: CellEditor | null
  saving: boolean
  sort?: TableSort
  onSort: (column: string) => void
  onCloseReference: () => void
  onBeginBlank: (column: number) => void
  onBeginNew: (key: string, column: number) => void
  onRemoveNew: (key: string) => void
  onDuplicateRows: (rows: (string | null)[][]) => void
  onRemoveRows: (rows: (string | null)[][]) => void
} & Pick<
  ComponentProps<typeof EditableTableRow>,
  'onBegin' | 'onValueChange' | 'onCommit' | 'onCancel' | 'onNull' | 'referenceOrigin' | 'onOpenReference'
>

export function EditableTable({
  data,
  visibleColumns,
  page,
  pageSize,
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
  onCloseReference,
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
  const selectedRows = menu ? menuRows : selection.selectedRows
  const canDuplicate = !saving && !data.readOnlyReason && selectedRows.length > 0
  const duplicate = () => {
    onDuplicateRows(selectedRows)
    selection.dismissMenu()
  }

  const canRemove =
    canDuplicate &&
    !!data.primaryKeys.length &&
    !selectedRows.some((row) => data.primaryKeys.some((index) => row[index] === null))
  const remove = () => {
    onRemoveRows(selectedRows)
    selection.dismissMenu()
  }

  useAppShortcut(duplicateRowsShortcut, canDuplicate, duplicate)
  useAppShortcut(removeRowsShortcut, canRemove, remove)

  return (
    <>
      <table className="selectable-table" onKeyDown={navigate}>
        <thead>
          <tr>
            <th className="row-number">#</th>
            {visibleColumns.map((index) => {
              const reference = foreignKeyFor(data, index)

              return (
                <ColumnHeader
                  key={index}
                  column={data.columns[index]}
                  primary={data.primaryKeys.includes(index)}
                  reference={reference && referenceTitle(reference)}
                  sort={sort}
                  disabled={saving}
                  onSort={onSort}
                  onContextMenu={(event) => selection.openMenu(event, index)}
                />
              )
            })}
          </tr>
        </thead>
        <tbody
          onClickCapture={(event) => {
            if (!actions.referenceOrigin || !(event.target instanceof Element)) return

            const row = event.target.closest('tr')
            if (!row || row.parentElement !== event.currentTarget) return

            const values = data.rows[row.sectionRowIndex]
            if (
              actions.referenceOrigin.tab !== active ||
              !values ||
              rowKey(values, data) !== actions.referenceOrigin.rowKey
            ) {
              onCloseReference()
            }
          }}
        >
          {data.rows.map((row, index) => {
            const key = rowKey(row, data)

            return (
              <EditableTableRow
                key={index}
                row={row}
                rowIndex={index}
                selection={selection}
                rowNumber={page * pageSize + index + 1}
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
        <ContextMenu
          label={`Actions for ${data.columns[menu.range.column]}`}
          className="tab-context-menu"
          x={menu.x}
          y={menu.y}
          trigger={menu.trigger}
          onDismiss={selection.dismissMenu}
          items={[
            ...(menu.range.mode === 'cells'
              ? [{ label: 'Copy All Column Values', disabled: !data.rows.length, onSelect: selection.copy }]
              : []),
            ...(menuRows.length
              ? [
                  {
                    label: `Duplicate ${rowLabel}`,
                    shortcut: formatAppShortcut(duplicateRowsShortcut),
                    disabled: !canDuplicate,
                    onSelect: duplicate
                  },
                  {
                    label: `${restoreRows ? 'Restore' : 'Remove'} ${rowLabel}`,
                    shortcut: formatAppShortcut(removeRowsShortcut),
                    disabled: !canRemove,
                    onSelect: remove
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
