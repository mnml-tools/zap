import type { ComponentProps } from 'react'
import type { Page, TableDraft, TableSort, CellEditor } from '../../types/table'
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
  return (
    <table>
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
  )
}
