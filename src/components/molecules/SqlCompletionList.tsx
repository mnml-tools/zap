import type { Ref } from 'react'
import { Columns3, Table2, Type } from 'lucide-react'
import type { CompletionItem } from '../../lib/sqlCompletion'

type Props = {
  id: string
  items: CompletionItem[]
  active: number
  query: string
  listRef: Ref<HTMLUListElement>
  onHover: (index: number) => void
  onPick: (index: number) => void
}

const icons = { table: Table2, column: Columns3, keyword: Type }

export function SqlCompletionList({ id, items, active, query, listRef, onHover, onPick }: Props) {
  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label="SQL suggestions"
      className="sql-completion"
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map((item, index) => {
        const Icon = icons[item.kind]
        const at = query ? item.label.toLowerCase().indexOf(query.toLowerCase()) : -1

        return (
          <li
            key={`${item.kind}:${item.insert}:${item.detail}`}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === active}
            className={index === active ? `active ${item.kind}` : item.kind}
            onMouseMove={() => index !== active && onHover(index)}
            onClick={() => onPick(index)}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="sql-completion-label">
              {at < 0 ? (
                item.label
              ) : (
                <>
                  {item.label.slice(0, at)}
                  <mark>{item.label.slice(at, at + query.length)}</mark>
                  {item.label.slice(at + query.length)}
                </>
              )}
            </span>
            {item.detail && <span className="sql-completion-detail">{item.detail}</span>}
          </li>
        )
      })}
    </ul>
  )
}
