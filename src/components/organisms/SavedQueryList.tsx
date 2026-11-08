import { Plus, FileCode2 } from 'lucide-react'
import type { SavedQuery } from '../../types/query'
import { SavedQueryListItem } from '../molecules/SavedQueryListItem'
import { Button, SidebarNav } from '@mnml-tools/ui'

type Props = {
  queries: SavedQuery[]
  search: string
  active: string
  dirty: Record<string, boolean>
  disabled: boolean
  onOpen: (query: SavedQuery) => void
  onCreate: () => void
}

export function SavedQueryList({ queries, search, active, dirty, disabled, onOpen, onCreate }: Props) {
  const filtered = queries.filter((query) =>
    (query.title + ' ' + query.sql).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SidebarNav label="Saved queries">
      {filtered.map((query) => (
        <SavedQueryListItem
          key={query.id}
          query={query}
          active={active === `query:${query.id}`}
          dirty={!!dirty[query.id]}
          disabled={disabled}
          onOpen={onOpen}
        />
      ))}
      {queries.length === 0 ? (
        <div className="query-list-empty">
          <FileCode2 size={23} strokeWidth={1} />
          <p>No saved queries</p>
          <Button disabled={disabled} onClick={onCreate}>
            <Plus size={12} />
            New query
          </Button>
        </div>
      ) : (
        !filtered.length && <p className="no-results">No matching queries</p>
      )}
    </SidebarNav>
  )
}
