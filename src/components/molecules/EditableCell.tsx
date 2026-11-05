import type { ComponentProps } from 'react'
import { CellEditorInput } from './CellEditorInput'
import { NullValue } from '../atoms/NullValue'

type Props = {
  value: string | null
  editable: boolean
  modified: boolean
  saving: boolean
  editing: boolean
  onBegin: () => void
  editOnClick?: boolean
  hint?: string
  emptyLabel?: string
  selected?: boolean
  selectionEvents?: Pick<ComponentProps<'td'>, 'onPointerDown' | 'onPointerEnter' | 'onContextMenu'>
} & ComponentProps<typeof CellEditorInput>

export function EditableCell({
  value,
  editable,
  modified,
  saving,
  editing,
  onBegin,
  editOnClick = false,
  hint,
  emptyLabel,
  selected,
  selectionEvents,
  ...editor
}: Props) {
  return (
    <td
      {...(!editing ? selectionEvents : undefined)}
      data-selected={selected}
      tabIndex={editable && !saving ? 0 : undefined}
      className={`${editable ? 'editable-cell' : ''} ${modified ? 'cell-edited' : ''} ${editing ? 'cell-editing' : ''}`}
      title={editable ? (hint ?? 'Double-click to edit') : (value ?? 'NULL')}
      onClick={editOnClick && editable && !saving && !editing ? onBegin : undefined}
      onDoubleClick={!editOnClick && editable && !saving && !editing ? onBegin : undefined}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === 'F2')) {
          event.preventDefault()
          onBegin()
        }
      }}
    >
      {editing ? (
        <CellEditorInput value={value} {...editor} />
      ) : value === null ? (
        emptyLabel ? (
          <span className="null">{emptyLabel}</span>
        ) : (
          <NullValue />
        )
      ) : (
        value
      )}
    </td>
  )
}
