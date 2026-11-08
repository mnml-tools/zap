import { useCallback, useId, useRef, useState } from 'react'
import type { SavedQuery } from '../../types/query'
import type { Table } from '../../types/table'
import type { GoToItem, GoToScope } from '../../lib/goTo'
import { goToShortcut } from '../../lib/shortcuts'
import { GoToMenu } from './GoToMenu'
import { useShortcut } from '@mnml-tools/ui'

type Props = {
  connectionTitle: string
  tables: Table[]
  queries: SavedQuery[]
  disabled: boolean
  onOpenTable: (table: Table) => void
  onOpenQuery: (query: SavedQuery) => void
}

export function GoToNavigator({ connectionTitle, tables, queries, disabled, onOpenTable, onOpenQuery }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<GoToScope>('all')
  const returnFocus = useRef<HTMLElement | null>(null)
  const id = useId()

  const dismiss = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus && returnFocus.current?.isConnected) returnFocus.current.focus()
    returnFocus.current = null
  }, [])

  const choose = (item: GoToItem) => {
    dismiss(false)
    if (item.kind === 'table') onOpenTable(item.table)
    else onOpenQuery(item.query)
  }

  useShortcut(goToShortcut, !disabled, () => {
    if (open) return

    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen(true)
  })

  return (
    open &&
    !disabled && (
      <GoToMenu
        id={id}
        connectionTitle={connectionTitle}
        tables={tables}
        queries={queries}
        search={search}
        scope={scope}
        onSearch={setSearch}
        onScope={setScope}
        onDismiss={dismiss}
        onChoose={choose}
      />
    )
  )
}
