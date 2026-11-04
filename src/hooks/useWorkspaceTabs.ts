import { useEffect, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { Table, TableMode } from '../types/table'
import { tableKey } from '../lib/tableState'

type Options = { id: string; request: ApiRequest; onError: (message: string) => void }

export function useWorkspaceTabs({ id, request, onError }: Options) {
  const [tables, setTables] = useState<Table[]>([]),
    [tabs, setTabs] = useState<Table[]>([]),
    [active, setActive] = useState('')
  const [modes, setModes] = useState<Partial<Record<string, TableMode>>>({})
  const table = tabs.find((item) => tableKey(item) === active)

  const refreshTables = () => {
    request<Table[]>('list_tables', { id })
      .then(setTables)
      .catch((error) => onError(String(error)))
  }

  useEffect(refreshTables, [id])

  const openTable = (table: Table) => {
    if (!tabs.some((item) => tableKey(item) === tableKey(table))) setTabs([...tabs, table])

    setActive(tableKey(table))
  }

  const selectTable = (table: Table) => setActive(tableKey(table))

  const selectTableMode = (mode: TableMode) => setModes((previous) => ({ ...previous, [active]: mode }))

  const renameTable = (original: Table, name: string) => {
    const key = tableKey(original)
    const renamed = { ...original, name }
    const nextKey = tableKey(renamed)
    const rename = (items: Table[]) => items.map((item) => (tableKey(item) === key ? renamed : item))

    setTables(rename)
    setTabs(rename)
    setModes((previous) => {
      const next = { ...previous, [nextKey]: previous[key] }
      delete next[key]

      return next
    })
    setActive((current) => (current === key ? nextKey : current))
  }

  const closeTables = (keys: Set<string>) => {
    const next = tabs.filter((item) => !keys.has(tableKey(item)))
    setTabs((current) => current.filter((item) => !keys.has(tableKey(item))))
    setModes((previous) => {
      const nextModes = { ...previous }
      for (const key of keys) delete nextModes[key]

      return nextModes
    })

    const fallback = next.at(-1)
    setActive((current) => (keys.has(current) ? (fallback ? tableKey(fallback) : '') : current))
  }

  return {
    tables,
    tabs,
    active,
    setActive,
    table,
    tableMode: modes[active] ?? 'data',
    selectTableMode,
    refreshTables,
    openTable,
    selectTable,
    closeTables,
    renameTable
  }
}
