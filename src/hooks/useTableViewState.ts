import { useEffect, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { Table, Page, TableSort } from '../types/table'
import type { FilterState, TableFilter } from '../types/filter'
import { newFilter } from '../lib/filters'
import { nextSort } from '../lib/tableState'

type Options = {
  id: string
  active: string
  table?: Table
  request: ApiRequest
  onError: (message: string) => void
}

export function useTableViewState({ id, active, table, request, onError }: Options) {
  const [hiddenByTab, setHiddenByTab] = useState<Record<string, string[]>>({})
  const [pages, setPages] = useState<Record<string, number>>({}),
    [sorts, setSorts] = useState<Record<string, TableSort>>({})
  const [filters, setFilters] = useState<Record<string, FilterState>>({}),
    [tableColumns, setTableColumns] = useState<Record<string, string[]>>({})
  const [data, setData] = useState<Page | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0)
  const page = pages[active] || 0,
    sort = sorts[active],
    currentFilters = filters[active]
  const applied = currentFilters?.applied || [],
    filterSignature = JSON.stringify(applied),
    sortSignature = JSON.stringify(sort)
  const columns = data?.columns || tableColumns[active] || [],
    enabledFilters = applied.filter((filter) => filter.enabled).length

  useEffect(() => {
    let canceled = false
    setData(null)

    if (!table) return

    setLoading(true)
    onError('')
    request<Page>('table_page', { id, table, page, filters: applied, sort: sort || null })
      .then((value) => {
        if (!canceled) {
          setData(value)
          setTableColumns((all) => ({ ...all, [active]: value.columns }))
        }
      })
      .catch((error) => {
        if (!canceled) onError(String(error))
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [id, active, page, revision, filterSignature, sortSignature])

  const reload = () => setRevision((value) => value + 1)

  const firstPage = () => setPages((all) => ({ ...all, [active]: 0 }))

  const state = (): FilterState => filters[active] || { open: false, draft: [], applied: [] }

  const toggleFilters = () => {
    const current = state()
    setFilters((all) => ({
      ...all,
      [active]: {
        ...current,
        open: !current.open,
        draft: current.draft.length ? current.draft : [newFilter(columns)]
      }
    }))
  }

  const hideFilters = () => setFilters((all) => ({ ...all, [active]: { ...state(), open: false } }))

  const changeFilters = (rows: TableFilter[]) =>
    setFilters((all) => ({ ...all, [active]: { ...state(), draft: rows } }))

  const applyFilters = (rows: TableFilter[]) => {
    setFilters((all) => ({
      ...all,
      [active]: { ...state(), applied: rows.map((row) => ({ ...row })) }
    }))
    firstPage()
    reload()
  }

  const clearFilters = () => {
    setFilters((all) => ({ ...all, [active]: { ...state(), draft: [newFilter(columns)], applied: [] } }))
    firstPage()
    reload()
  }

  // Opening a reference in its tab replaces that tab's filters and returns it to the first page.
  const presetFilters = (key: string, rows: TableFilter[]) => {
    setFilters((all) => ({ ...all, [key]: { open: true, draft: rows, applied: rows.map((row) => ({ ...row })) } }))
    setPages((all) => ({ ...all, [key]: 0 }))
    reload()
  }

  const removeFilter = (id: string) => {
    const current = state()

    if (current.draft.length <= 1) return

    setFilters((all) => ({
      ...all,
      [active]: {
        ...current,
        draft: current.draft.filter((row) => row.id !== id),
        applied: current.applied.filter((row) => row.id !== id)
      }
    }))
    firstPage()
  }

  const toggleSort = (column: string) => {
    setSorts((all) => {
      const next = nextSort(all[active], column)

      if (!next) {
        const result = { ...all }
        delete result[active]

        return result
      }

      return { ...all, [active]: next }
    })
    firstPage()
  }

  const reset = () => {
    firstPage()
    setFilters((all) => {
      const next = { ...all }
      delete next[active]

      return next
    })
    setSorts((all) => {
      const next = { ...all }
      delete next[active]

      return next
    })
    reload()
  }

  const previousPage = () => setPages((all) => ({ ...all, [active]: page - 1 }))

  const nextPage = () => setPages((all) => ({ ...all, [active]: page + 1 }))

  return {
    page,
    data,
    loading,
    columns,
    hiddenColumns: hiddenByTab[active] ?? [],
    setHiddenColumns: (hidden: string[]) => setHiddenByTab((previous) => ({ ...previous, [active]: hidden })),
    sort,
    currentFilters,
    enabledFilters,
    reload,
    reset,
    toggleFilters,
    hideFilters,
    changeFilters,
    applyFilters,
    clearFilters,
    presetFilters,
    removeFilter,
    toggleSort,
    previousPage,
    nextPage
  }
}
