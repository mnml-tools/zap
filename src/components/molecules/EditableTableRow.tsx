import type { Page, CellEditor, DraftRow } from '../../types/table'
import type { useColumnSelection } from '../../hooks/useColumnSelection'
import type { ReferenceOrigin } from '../../hooks/useReferencePanel'
import type { Reference } from '../../lib/relations'
import { foreignKeyFor, referenceFrom, referenceTitle } from '../../lib/relations'
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
  referenceOrigin: ReferenceOrigin | null
  onOpenReference: (reference: Reference, origin: ReferenceOrigin) => void
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
  onNull,
  referenceOrigin,
  onOpenReference
}: Props) {
  // References follow the values on screen, including staged edits.
  const shown = row.map((value, column) =>
    draft && Object.hasOwn(draft.changes, column) ? draft.changes[column] : value
  )
  const activeOrigin = referenceOrigin?.tab === active && referenceOrigin.rowKey === rowKey ? referenceOrigin : null

  return (
    <tr className={draft ? 'row-edited' : undefined}>
      <td className="row-number">{rowNumber}</td>
      {visibleColumns.map((column) => {
        const original = row[column]
        const modified = !!draft && Object.hasOwn(draft.changes, column),
          value = modified ? draft!.changes[column] : original
        const editing = editor?.tab === active && editor.rowKey === rowKey && editor.column === column
        const key = foreignKeyFor(data, column)
        const reference = key && referenceFrom(key, shown)

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
            editable={data.editable[column] && !data.primaryKeys.some((index) => row[index] === null)}
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
            reference={
              key && reference
                ? {
                    title: referenceTitle(key),
                    active: !!activeOrigin?.columns.includes(column),
                    onOpen: () => onOpenReference(reference, { tab: active, rowKey, columns: key.columns })
                  }
                : undefined
            }
          />
        )
      })}
    </tr>
  )
}
