import { FileCode2 } from 'lucide-react'
import type { SavedQuery } from '../../types/query'
import { DirtyIndicator, SidebarItem } from '@mnml-tools/ui'

type Props = {
  query: SavedQuery
  active: boolean
  dirty: boolean
  disabled: boolean
  onOpen: (query: SavedQuery) => void
}

export function SavedQueryListItem({ query, active, dirty, disabled, onOpen }: Props) {
  return (
    <SidebarItem active={active} disabled={disabled} onClick={() => onOpen(query)}>
      <FileCode2 size={14} />
      <span>{query.title}</span>
      {dirty && <DirtyIndicator />}
    </SidebarItem>
  )
}
