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
  hint?: string
} & ComponentProps<typeof CellEditorInput>

export function EditableCell({ value, editable, modified, saving, editing, onBegin, hint, ...editor }: Props) {
  return (
    <td
      tabIndex={editable && !saving ? 0 : undefined}
      className={`${editable ? 'editable-cell' : ''} ${modified ? 'cell-edited' : ''} ${editing ? 'cell-editing' : ''}`}
      title={editable ? (hint ?? 'Double-click to edit') : (value ?? 'NULL')}
      onDoubleClick={onBegin}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === 'F2')) {
          event.preventDefault()
          onBegin()
        }
      }}
    >
      {editing ? <CellEditorInput value={value} {...editor} /> : value === null ? <NullValue /> : value}
    </td>
  )
}
