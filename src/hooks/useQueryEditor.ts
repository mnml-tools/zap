import { activeParameters, parameterSql } from '../lib/queryParameters'
import type { QueryParameter } from '../types/query'
import { useEffect, useRef, useState } from 'react'
import type { QueryDocument, SavedQuery, QueryResult } from '../types/query'
import type { ApiRequest } from '../services/api'

export type QueryEditorOptions = {
  driver: string
  connectionId: string
  query: QueryDocument
  request: ApiRequest
  onSaved: (query: SavedQuery) => void
  onConvertQuick: (query: QueryDocument) => void
  onDirty: (id: string, dirty: boolean) => void
  onBusy: (id: string, busy: boolean) => void
  onExecuted: () => void
}

export function useQueryEditor({
  connectionId,
  driver,
  query,
  request,
  onSaved,
  onConvertQuick,
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
  const [parameterValues, setParameterValues] = useState<QueryParameter[]>(query.parameters ?? [])
  const parameters = activeParameters(sql, parameterValues)
  const parametersDirty =
    JSON.stringify(parameters) !== JSON.stringify(activeParameters(baseline?.sql ?? '', baseline?.parameters ?? []))
  const setParameter = (parameter: QueryParameter) =>
    setParameterValues((values) => [...values.filter((value) => value.name !== parameter.name), parameter])

  const busyRef = useRef(false)
  const dirty = baseline
    ? title !== baseline.title || sql !== baseline.sql || parametersDirty
    : !!sql.trim() || title !== query.title

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
    if (query.quick || !title.trim() || !sql.trim() || !dirty || !begin('save')) return

    try {
      const saved = await request<SavedQuery>('save_query', {
        query: { id: query.id, connectionId, title, sql, parameters }
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
      const value = await request<QueryResult>('run_query', {
        id: connectionId,
        sql: parameterSql(sql, parameters, driver)
      })
      setResult(value)
      setResultIndex(0)
      onExecuted()
    } catch (e) {
      setError(String(e))
    } finally {
      finish()
    }
  }

  const convertQuick = () => {
    if (!query.quick || !result || busyRef.current) return

    const title = 'Untitled query'
    setTitle(title)
    onConvertQuick({ ...query, title, sql, parameters, quick: false })
  }

  return {
    parameters,
    setParameter,
    convertQuick,
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
    unsaved: !baseline,
    save,
    run
  }
}
