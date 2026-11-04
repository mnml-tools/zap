import { useEffect, useRef, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { SavedQuery, QueryDocument } from '../types/query'

type Options = {
  id: string
  request: ApiRequest
  active: string
  fallbackTab: string
  onSelect: (key: string) => void
  onError: (message: string) => void
}

export function useSavedQueries({ id, request, active, fallbackTab, onSelect, onError }: Options) {
  const [queries, setQueries] = useState<SavedQuery[]>([]),
    [tabs, setTabs] = useState<QueryDocument[]>([]),
    [search, setSearch] = useState(''),
    [error, setError] = useState('')
  const [dirty, setDirty] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState<Record<string, boolean>>({})
  const dirtyRef = useRef(dirty),
    busyRef = useRef(busy)
  const currentQuery = tabs.find((query) => `query:${query.id}` === active),
    anyDirty = Object.values(dirty).some(Boolean),
    anyBusy = Object.values(busy).some(Boolean)

  useEffect(() => {
    request<SavedQuery[]>('list_queries', { id })
      .then(setQueries)
      .catch((error) => setError(String(error)))
  }, [id])

  const markDirty = (queryId: string, value: boolean) => {
    const next = { ...dirtyRef.current, [queryId]: value }
    dirtyRef.current = next
    setDirty(next)
  }

  const markBusy = (queryId: string, value: boolean) => {
    const next = { ...busyRef.current, [queryId]: value }
    busyRef.current = next
    setBusy(next)
  }

  const open = (query: QueryDocument) => {
    if (!tabs.some((item) => item.id === query.id)) setTabs((all) => [...all, query])

    onSelect(`query:${query.id}`)
  }

  const create = () =>
    open({
      id: crypto.randomUUID(),
      connectionId: id,
      title: 'Untitled query',
      sql: '',
      isNew: true
    })

  const saved = (query: SavedQuery) => {
    setQueries((all) =>
      all.some((item) => item.id === query.id)
        ? all.map((item) => (item.id === query.id ? query : item))
        : [...all, query]
    )
    setTabs((all) => all.map((item) => (item.id === query.id ? query : item)))
    markDirty(query.id, false)
  }

  const dismissMany = (ids: Set<string>, fallback = fallbackTab) => {
    setTabs((all) => all.filter((item) => !ids.has(item.id)))
    for (const id of ids) {
      markDirty(id, false)
      markBusy(id, false)
    }

    if (active.startsWith('query:') && ids.has(active.slice(6))) {
      const next = tabs.filter((item) => !ids.has(item.id)).at(-1)
      onSelect(next ? `query:${next.id}` : fallback)
    }
  }

  const dismiss = (query: QueryDocument) => dismissMany(new Set([query.id]))

  const remove = (query: QueryDocument) => {
    if (query.isNew) {
      dismiss(query)

      return
    }

    markBusy(query.id, true)
    request('remove_query', { id, queryId: query.id })
      .then(() => {
        setQueries((all) => all.filter((item) => item.id !== query.id))
        dismiss(query)
      })
      .catch((error) => onError(String(error)))
      .finally(() => markBusy(query.id, false))
  }

  return {
    queries,
    tabs,
    search,
    setSearch,
    error,
    dirty,
    busy,
    dirtyRef,
    busyRef,
    currentQuery,
    anyDirty,
    anyBusy,
    markDirty,
    markBusy,
    open,
    create,
    saved,
    dismiss,
    dismissMany,
    remove
  }
}
