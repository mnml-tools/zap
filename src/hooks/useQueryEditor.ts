import { useEffect, useRef, useState } from 'react'
import type { QueryDocument, SavedQuery, QueryResult } from '../types/query'
import type { ApiRequest } from '../services/api'

export type QueryEditorOptions = {
  connectionId: string
  query: QueryDocument
  request: ApiRequest
  onSaved: (query: SavedQuery) => void
  onDirty: (id: string, dirty: boolean) => void
  onBusy: (id: string, busy: boolean) => void
  onExecuted: () => void
}

export function useQueryEditor({
  connectionId,
  query,
  request,
  onSaved,
  onDirty,
  onBusy,
  onExecuted
}: QueryEditorOptions) {
  const [title, setTitle] = useState(query.title),
    [sql, setSql] = useState(query.sql),
    [baseline, setBaseline] = useState<SavedQuery | null>(query.isNew ? null : query)
  const [busy, setBusy] = useState<'save' | 'run' | null>(null),
    [error, setError] = useState(''),
    [result, setResult] = useState<QueryResult | null>(null),
    [resultIndex, setResultIndex] = useState(0)
  const busyRef = useRef(false)
  const dirty = !baseline || title !== baseline.title || sql !== baseline.sql

  useEffect(() => {
    onDirty(query.id, dirty)
  }, [dirty, query.id])

  const begin = (value: 'save' | 'run') => {
    if (busyRef.current) return false

    busyRef.current = true
    setBusy(value)
    onBusy(query.id, true)
    setError('')

    return true
  }

  const finish = () => {
    busyRef.current = false
    setBusy(null)
    onBusy(query.id, false)
  }

  const save = async () => {
    if (!title.trim() || !sql.trim() || !dirty || !begin('save')) return

    try {
      const saved = await request<SavedQuery>('save_query', {
        query: { id: query.id, connectionId, title, sql }
      })
      setTitle(saved.title)
      setBaseline(saved)
      onSaved(saved)
    } catch (e) {
      setError(String(e))
    } finally {
      finish()
    }
  }

  const run = async () => {
    if (!sql.trim() || !begin('run')) return

    setResult(null)

    try {
      const value = await request<QueryResult>('run_query', { id: connectionId, sql })
      setResult(value)
      setResultIndex(0)
      onExecuted()
    } catch (e) {
      setError(String(e))
    } finally {
      finish()
    }
  }

  return {
    title,
    setTitle,
    sql,
    setSql,
    busy,
    error,
    result,
    resultIndex,
    setResultIndex,
    dirty,
    save,
    run
  }
}
