import type { MouseEvent } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { TableSort } from '../../types/table'
import { Button } from '../atoms/Button'

type Props = {
  column: string
  primary: boolean
  reference?: string
  sort?: TableSort
  disabled: boolean
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
  onSort: (column: string) => void
}

export function ColumnHeader({ column, primary, reference, sort, disabled, onSort, onContextMenu }: Props) {
  return (
    <th aria-sort={sort?.column === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Button
        className="column-sort"
        disabled={disabled}
        onContextMenu={onContextMenu}
        onClick={() => onSort(column)}
        title={
          sort?.column === column && sort.direction === 'desc'
            ? `Remove sort on ${column}`
            : `Sort ${column} ${sort?.column === column ? 'descending' : 'ascending'}`
        }
      >
        {column}
        {primary && (
          <span className="key-label" title="Primary key">
            PK
          </span>
        )}
        {reference && (
          <span className="key-label" title={reference}>
            FK
          </span>
        )}
        {sort?.column === column &&
          (sort.direction === 'asc' ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          ))}
      </Button>
    </th>
  )
}
