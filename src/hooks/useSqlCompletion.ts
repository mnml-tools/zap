import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { Table } from '../types/table'
import { completeSql, referencedTables } from '../lib/sqlCompletion'
import type { SqlColumn } from '../lib/sqlCompletion'
import { tableKey } from '../lib/tableState'

type Options = { connectionId: string; driver: string; request: ApiRequest; tables: Table[]; sql: string }

/** Loads columns only for tables the SQL references; a refreshed table list discards cached columns. */

export function useSqlCompletion({ connectionId, driver, request, tables, sql }: Options) {
  const [columns, setColumns] = useState<Record<string, SqlColumn[]>>({})
  const loading = useRef(new Set<string>()),
    generation = useRef(0)

  useEffect(() => {
    generation.current++
    loading.current.clear()
    setColumns({})
  }, [connectionId, tables])

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = generation.current

      for (const table of referencedTables(sql, tables)) {
        const key = tableKey(table)

        if (key in columns || loading.current.has(key)) continue

        loading.current.add(key)
        request<(string | null)[][]>('table_columns', { id: connectionId, table })
          .then((rows) => rows.map(([name, type]) => ({ name: name ?? '', type: type ?? '' })))
          .catch(() => [])
          .then((list) => {
            if (current !== generation.current) return

            loading.current.delete(key)
            setColumns((previous) => ({ ...previous, [key]: list }))
          })
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [connectionId, request, tables, sql, columns])

  return useCallback(
    (value: string, cursor: number) =>
      completeSql(value, cursor, { driver, tables, columns: (table) => columns[tableKey(table)] }),
    [driver, tables, columns]
  )
}
