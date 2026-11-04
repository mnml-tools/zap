import { FileCode2 } from 'lucide-react'
import type { SavedQuery } from '../../types/query'
import { Button } from '../atoms/Button'
import { DirtyIndicator } from '../atoms/DirtyIndicator'

type Props = {
  query: SavedQuery
  active: boolean
  dirty: boolean
  disabled: boolean
  onOpen: (query: SavedQuery) => void
}

export function SavedQueryListItem({ query, active, dirty, disabled, onOpen }: Props) {
  return (
    <Button className={active ? 'active' : ''} disabled={disabled} onClick={() => onOpen(query)}>
      <FileCode2 size={14} />
      <span>{query.title}</span>
      {dirty && <DirtyIndicator />}
    </Button>
  )
}
