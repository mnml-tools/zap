import type { Page, CellEditor, DraftRow } from '../../types/table'
import type { useColumnSelection } from '../../hooks/useColumnSelection'
import { EditableCell } from './EditableCell'

type Props = {
  row: (string | null)[]
  rowNumber: number
  rowIndex: number
  selection: ReturnType<typeof useColumnSelection>
  rowKey: string
  active: string
  data: Page
  visibleColumns: number[]
  draft?: DraftRow
  editor: CellEditor | null
  saving: boolean
  onBegin: (row: (string | null)[], column: number) => void
  onValueChange: (value: string | null) => void
  onCommit: () => void
  onCancel: () => void
  onNull: () => void
}

export function EditableTableRow({
  row,
  rowNumber,
  rowIndex,
  selection,
  rowKey,
  active,
  data,
  visibleColumns,
  draft,
  editor,
  saving,
  onBegin,
  onValueChange,
  onCommit,
  onCancel,
  onNull
}: Props) {
  return (
    <tr
      data-row-selected={selection.includesRow(rowIndex)}
      className={draft?.deleted ? 'row-deleted' : draft ? 'row-edited' : undefined}
    >
      <td
        className="row-number row-selector"
        tabIndex={0}
        aria-label={`Select row ${rowNumber}`}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            selection.selectRow(visibleColumns[0], rowIndex, event.shiftKey)
          }
        }}
        onPointerDown={(event) => selection.start(event, visibleColumns[0], rowIndex, 'rows')}
        onPointerEnter={(event) => selection.extend(event, visibleColumns[0], rowIndex, 'rows')}
        onContextMenu={(event) => selection.openMenu(event, selection.column ?? visibleColumns[0], rowIndex, true)}
        title={draft?.deleted ? 'Row will be removed when changes are saved' : undefined}
      >
        {rowNumber}
      </td>
      {visibleColumns.map((column) => {
        const original = row[column]
        const modified = !!draft && Object.hasOwn(draft.changes, column),
          value = modified ? draft!.changes[column] : original
        const editing = editor?.tab === active && editor.rowKey === rowKey && editor.column === column

        return (
          <EditableCell
            key={column}
            selected={selection.includes(column, rowIndex)}
            selectionEvents={{
              onPointerDown: (event) => selection.start(event, column, rowIndex),
              onPointerEnter: (event) => selection.extend(event, column, rowIndex),
              onContextMenu: (event) => selection.openMenu(event, column, rowIndex)
            }}
            value={value}
            editable={
              !draft?.deleted && data.editable[column] && !data.primaryKeys.some((index) => row[index] === null)
            }
            modified={modified}
            saving={saving}
            editing={editing}
            column={data.columns[column]}
            rowNumber={rowNumber}
            onBegin={() => onBegin(row, column)}
            onChange={onValueChange}
            onCommit={onCommit}
            onCancel={onCancel}
            onNull={onNull}
          />
        )
      })}
    </tr>
  )
}
