import { useRef, useState } from 'react'
import type { ApiRequest } from '../services/api'
import type { Table, Page, TableDraft, CellEditor } from '../types/table'
import { stageCell, rowKey, countChanges, toggleRowsRemoval } from '../lib/tableState'

type Options = {
  id: string
  active: string
  table?: Table
  data: Page | null
  request: ApiRequest
  onError: (message: string) => void
  onSaved: () => void
}

export function useTableDrafts({ id, active, table, data, request, onError, onSaved }: Options) {
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({}),
    [editor, setEditor] = useState<CellEditor | null>(null),
    [saving, setSaving] = useState(false)
  const draftsRef = useRef(drafts),
    editorRef = useRef(editor),
    savingRef = useRef(false),
    cancelEdit = useRef(false)

  const setAll = (next: Record<string, TableDraft>) => {
    draftsRef.current = next
    setDrafts(next)
  }

  const editCell = (next: CellEditor | null) => {
    editorRef.current = next
    setEditor(next)
  }

  const pending = stageCell(draftsRef.current, editorRef.current),
    changeCount = countChanges(pending[active])

  const stage = () => {
    const next = stageCell(draftsRef.current, editorRef.current)
    setAll(next)
    editCell(null)

    return next
  }

  const save = async () => {
    if (!table || savingRef.current) return

    const draft = stage()[active]

    if (!countChanges(draft)) return

    savingRef.current = true
    setSaving(true)
    onError('')

    try {
      await request('save_table_changes', {
        id,
        table,
        columns: draft.columns,
        edits: Object.values(draft.rows).map((row) => ({
          original: row.original,
          deleted: !!row.deleted,
          inserted: !!row.inserted,
          changes: Object.entries(row.deleted ? {} : row.changes).map(([index, value]) => ({
            column: draft.columns[Number(index)],
            value
          }))
        }))
      })
      const next = { ...draftsRef.current }
      delete next[active]
      setAll(next)
      onSaved()
    } catch (error) {
      onError(String(error))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const beginEdit = (row: (string | null)[], column: number) => {
    if (!data || !data.editable[column] || savingRef.current || data.primaryKeys.some((index) => row[index] === null))
      return

    stage()
    const key = rowKey(row, data),
      draft = draftsRef.current[active]?.rows[key]

    if (draft?.deleted) return

    cancelEdit.current = false
    editCell({
      tab: active,
      rowKey: key,
      row,
      column,
      value: draft && Object.hasOwn(draft.changes, column) ? draft.changes[column] : row[column],
      columns: data.columns
    })
  }

  const addRow = (column?: number) => {
    if (!data || data.readOnlyReason || savingRef.current) return

    const staged = stage()
    const key = `new:${crypto.randomUUID()}`
    const draft = staged[active]
    setAll({
      ...staged,
      [active]: {
        columns: data.columns,
        rows: { ...draft?.rows, [key]: { original: data.columns.map(() => null), changes: {}, inserted: true } }
      }
    })

    if (column !== undefined && data.editable[column]) {
      cancelEdit.current = false
      editCell({
        tab: active,
        rowKey: key,
        row: data.columns.map(() => null),
        column,
        value: null,
        columns: data.columns
      })
    }
  }

  const beginNewEdit = (key: string, column: number) => {
    if (!data || !data.editable[column] || savingRef.current) return

    stage()
    const row = draftsRef.current[active]?.rows[key]

    if (!row?.inserted) return

    cancelEdit.current = false
    editCell({
      tab: active,
      rowKey: key,
      row: row.original,
      column,
      value: row.changes[column] ?? null,
      columns: data.columns
    })
  }

  const removeNewRow = (key: string) => {
    if (savingRef.current) return

    const staged = stage()
    const draft = staged[active]

    if (!draft?.rows[key]?.inserted) return

    const rows = { ...draft.rows }
    delete rows[key]
    const next = { ...staged }

    if (Object.keys(rows).length) next[active] = { ...draft, rows }
    else delete next[active]

    setAll(next)
  }

  const removeRows = (rows: (string | null)[][]) => {
    if (!data || data.readOnlyReason || !data.primaryKeys.length || savingRef.current) return
    if (rows.some((row) => data.primaryKeys.some((index) => row[index] === null))) return

    const staged = stage()
    setAll(toggleRowsRemoval(staged, active, rows, data))
  }

  const setCellValue = (value: string | null) => {
    if (editorRef.current) editCell({ ...editorRef.current, value })
  }

  const commitCell = () => {
    if (cancelEdit.current) {
      cancelEdit.current = false

      return
    }

    stage()
  }

  const cancelCell = () => {
    cancelEdit.current = true
    editCell(null)
  }

  const nullCell = () => {
    setCellValue(null)
    stage()
  }

  const discardTable = (key: string) => {
    const next = { ...draftsRef.current }
    delete next[key]
    setAll(next)
  }

  const clearAll = () => {
    setAll({})
    editCell(null)
  }

  return {
    pending,
    editor,
    changeCount,
    saving,
    draftsRef,
    editorRef,
    savingRef,
    stage,
    save,
    beginEdit,
    addRow,
    beginNewEdit,
    removeNewRow,
    removeRows,
    setCellValue,
    commitCell,
    cancelCell,
    nullCell,
    discardTable,
    clearAll
  }
}
