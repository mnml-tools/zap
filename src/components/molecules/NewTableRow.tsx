import type { ComponentProps } from 'react'
import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import type { Page, DraftRow, CellEditor } from '../../types/table'
import { EditableCell } from './EditableCell'
import { Button } from '../atoms/Button'

type Props = {
  placeholder?: boolean
  data: Page
  draft: DraftRow
  visibleColumns: number[]
  editor: CellEditor | null
  saving: boolean
  onBegin: (column: number) => void
  onRemove: () => void
  onValueChange: (value: string | null) => void
} & Pick<ComponentProps<typeof EditableCell>, 'onCommit' | 'onCancel' | 'onNull'>

export function NewTableRow({
  placeholder = false,
  data,
  draft,
  visibleColumns,
  editor,
  saving,
  onBegin,
  onRemove,
  onValueChange,
  ...actions
}: Props) {
  const row = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    if (placeholder) return

    row.current?.scrollIntoView({ block: 'nearest' })
    if (!editor) row.current?.querySelector<HTMLElement>('td[tabindex="0"]')?.focus({ preventScroll: true })
  }, [])

  return (
    <tr ref={row} className={placeholder ? 'row-placeholder row-inserted' : 'row-edited row-inserted'}>
      <td className="row-number">
        {placeholder ? (
          <span title="Click a cell to add a new row" aria-label="New row">
            <Plus size={12} />
          </span>
        ) : (
          <Button aria-label="Remove new row" title="Remove new row" disabled={saving} onClick={onRemove}>
            <X size={12} />
          </Button>
        )}
      </td>
      {visibleColumns.map((column) => (
        <EditableCell
          key={column}
          editOnClick
          value={draft.changes[column] ?? null}
          emptyLabel={placeholder ? ' ' : Object.hasOwn(draft.changes, column) ? undefined : 'DEFAULT'}
          hint={
            placeholder
              ? 'Click to enter a value for a new row'
              : 'Click to set a value. Untouched fields use database defaults.'
          }
          editable={data.editable[column]}
          modified={Object.hasOwn(draft.changes, column)}
          saving={saving}
          editing={editor?.column === column}
          column={data.columns[column]}
          rowNumber={0}
          onBegin={() => {
            if (!saving && data.editable[column]) onBegin(column)
          }}
          onChange={onValueChange}
          {...actions}
        />
      ))}
    </tr>
  )
}
