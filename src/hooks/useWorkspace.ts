import { useEffect, useRef, useState } from 'react'
import { registerUpdateGuard } from '../services/updateGuard'
import { api } from '../services/api'
import type { ApiRequest } from '../services/api'
import type { Connection, Table, QueryDocument, TableFilter } from '../types'
import type { StructureDraft, TableMode } from '../types/table'
import { tableKey, countChanges } from '../lib/tableState'
import { useWorkspaceTabs } from './useWorkspaceTabs'
import { useTableViewState } from './useTableViewState'
import { useTableDrafts } from './useTableDrafts'
import { useSavedQueries } from './useSavedQueries'
import { useUnsavedChanges } from './useUnsavedChanges'
import { useReferencePanel } from './useReferencePanel'
import { referenceFilters } from '../lib/relations'

export type WorkspaceOptions = {
  id: string
  connection?: Connection
  connections?: Connection[]
  onSwitch?: (connection: Connection) => Promise<void>
  onClose: () => Promise<void>
  request?: ApiRequest
}

export function useWorkspace({ id, connection, onClose, onSwitch, request = api }: WorkspaceOptions) {
  const [sidebar, setSidebar] = useState<'tables' | 'queries'>('tables'),
    [search, setSearch] = useState(''),
    [error, setError] = useState(''),
    [closing, setClosing] = useState(false)
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)
  const [structures, setStructures] = useState<Partial<Record<string, StructureDraft>>>({})
  const [tableActionBusy, setTableActionBusy] = useState(false)
  const [tableActionError, setTableActionError] = useState('')
  const [structureSaving, setStructureSaving] = useState(false)
  const [structureRevision, setStructureRevision] = useState(0)
  const tabs = useWorkspaceTabs({ id, request, onError: setError })
  const view = useTableViewState({
    id,
    request,
    active: tabs.active,
    table: tabs.table,
    onError: setError
  })
  const edits = useTableDrafts({
    id,
    request,
    active: tabs.active,
    table: tabs.table,
    data: view.data,
    onError: setError,
    onSaved: view.reload
  })
  const references = useReferencePanel({ id, request })
  const queries = useSavedQueries({
    id,
    request,
    active: tabs.active,
    fallbackTab: tabs.tabs.at(-1) ? tableKey(tabs.tabs.at(-1)!) : '',
    onSelect: tabs.setActive,
    onError: setError
  })

  const structureDirty = (key: string) => {
    const draft = structures[key]

    return !!(draft?.name !== undefined || draft?.changes.length || draft?.additions?.length)
  }

  const anyStructureDirty = Object.keys(structures).some(structureDirty)

  const setStructure = (draft: StructureDraft) => setStructures((all) => ({ ...all, [tabs.active]: draft }))

  const discardStructure = (key: string) =>
    setStructures((all) => {
      const next = { ...all }
      delete next[key]

      return next
    })

  const saveStructure = async (draft: StructureDraft) => {
    const table = tabs.table

    if (!table || structureSaving || edits.saving || edits.changeCount || edits.editorRef.current) return

    setStructureSaving(true)
    try {
      await request('save_table_structure', {
        id,
        table,
        name: draft.name ?? null,
        changes: draft.changes,
        additions: draft.additions ?? []
      })
      discardStructure(tabs.active)
      if (draft.name !== undefined) {
        tabs.renameTable(table, draft.name)
        tabs.refreshTables()
      }
      view.reset()
      setStructureRevision((revision) => revision + 1)
    } finally {
      setStructureSaving(false)
    }
  }

  const guard = (message: string, action: () => void, hasChanges: boolean) => {
    if (structureSaving || tableActionBusy) return

    edits.stage()

    if (hasChanges) setConfirm({ message, action })
    else action()
  }

  useUnsavedChanges({
    hasChanges: () =>
      Object.values(edits.draftsRef.current).some((draft) => countChanges(draft) > 0) ||
      !!edits.editorRef.current ||
      anyStructureDirty ||
      Object.values(queries.dirtyRef.current).some(Boolean),
    onError: (error) => setError(String(error)),
    onCloseRequested: (confirmClose) => {
      edits.stage()
      setConfirm({ message: 'Discard all pending changes and quit Zap?', action: confirmClose })
    }
  })

  const updateSafety = useRef(() => ({ dirty: false, busy: false }))
  updateSafety.current = () => ({
    dirty:
      Object.values(edits.draftsRef.current).some((draft) => countChanges(draft) > 0) ||
      !!edits.editorRef.current ||
      anyStructureDirty ||
      Object.values(queries.dirtyRef.current).some(Boolean),
    busy:
      structureSaving ||
      tableActionBusy ||
      edits.savingRef.current ||
      Object.values(queries.busyRef.current).some(Boolean)
  })

  useEffect(() => registerUpdateGuard(() => updateSafety.current()), [])

  const closeTabs = (keys: string[]) => {
    const targets = new Set(keys)
    const tableKeys = new Set(tabs.tabs.map(tableKey).filter((key) => targets.has(key)))
    const queryIds = new Set(queries.tabs.filter((query) => targets.has(`query:${query.id}`)).map((query) => query.id))

    if (!targets.size || tableActionBusy || structureSaving || edits.savingRef.current) return
    if ([...queryIds].some((id) => queries.busyRef.current[id])) return

    const staged = edits.stage()
    const dirty =
      [...tableKeys].some((key) => countChanges(staged[key]) > 0 || structureDirty(key)) ||
      [...queryIds].some((id) => queries.dirtyRef.current[id])

    guard(
      targets.size === 1
        ? 'Discard unsaved changes and close this tab?'
        : 'Discard unsaved changes and close these tabs?',
      () => {
        if ([...queryIds].some((id) => queries.busyRef.current[id])) return

        for (const key of tableKeys) {
          edits.discardTable(key)
          discardStructure(key)
        }

        const remainingTable = tabs.tabs.filter((table) => !tableKeys.has(tableKey(table))).at(-1)
        tabs.closeTables(tableKeys)
        queries.dismissMany(queryIds, remainingTable ? tableKey(remainingTable) : '')

        if (tableKeys.has(tabs.active) && !remainingTable) {
          const remainingQuery = queries.tabs.filter((query) => !queryIds.has(query.id)).at(-1)
          if (remainingQuery) tabs.setActive(`query:${remainingQuery.id}`)
        }
      },
      dirty
    )
  }

  const closeTab = (table: Table) => closeTabs([tableKey(table)])

  const copyTableName = (table: Table) => {
    navigator.clipboard.writeText(table.name).catch((error) => setTableActionError(String(error)))
  }

  const runTableAction = async (command: string, args: Record<string, unknown>, onSuccess?: () => void) => {
    setTableActionBusy(true)
    try {
      await request(command, { id, ...args })
      onSuccess?.()
    } catch (error) {
      setTableActionError(String(error))
    } finally {
      setTableActionBusy(false)
    }
  }

  const exportTable = (table: Table) => void runTableAction('export_table', { table })

  const exportTables = (tables: Table[], includeData: boolean) =>
    void runTableAction('export_tables', { tables, includeData })

  const importSql = async () => {
    if (tableActionBusy || structureSaving || edits.savingRef.current || queries.anyBusy) return

    const pending = edits.stage()
    if (Object.values(pending).some((draft) => countChanges(draft) > 0) || anyStructureDirty) {
      setTableActionError('Save or discard pending table edits before importing a SQL file.')

      return
    }

    setTableActionBusy(true)
    try {
      const path = await request<string | null>('pick_sql_file')
      if (path === null) return

      const filename = path.split(/[/\\]/).at(-1)
      const destination = connection?.title || 'the current connection'

      setConfirm({
        message: `Run “${filename}” on “${destination}”? This can modify or delete data. Only import files you trust.`,
        action: () => {
          setTableActionBusy(true)
          void request('import_sql_file', { id, path })
            .catch((error) => setTableActionError(String(error)))
            .finally(() => {
              tabs.refreshTables()
              view.reload()
              setStructureRevision((revision) => revision + 1)
              setTableActionBusy(false)
            })
        }
      })
    } catch (error) {
      setTableActionError(String(error))
    } finally {
      setTableActionBusy(false)
    }
  }

  const deleteTable = (table: Table) => {
    const key = tableKey(table)
    const title = table.schema ? `${table.schema}.${table.name}` : table.name

    guard(
      `Permanently delete “${title}” and all its rows? Any pending changes to this table will be discarded.`,
      () => {
        void runTableAction('delete_table', { table }, () => {
          edits.discardTable(key)
          discardStructure(key)
          tabs.closeTables(new Set([key]))
          tabs.refreshTables()
        })
      },
      true
    )
  }

  const leaveConnection = (action: () => Promise<void>, message: string) => {
    if (closing || edits.savingRef.current || Object.values(queries.busyRef.current).some(Boolean)) return

    const staged = edits.stage()
    guard(
      message,
      () => {
        if (edits.savingRef.current || Object.values(queries.busyRef.current).some(Boolean)) return

        setClosing(true)
        action().catch((error) => {
          setError(String(error))
          setClosing(false)
        })
      },
      Object.values(staged).some((draft) => countChanges(draft) > 0) || queries.anyDirty || anyStructureDirty
    )
  }

  const closeConnection = () => leaveConnection(onClose, 'Discard all pending changes and close the connection?')

  const switchConnection = (next: Connection) => {
    if (!onSwitch || next.id === id) return

    leaveConnection(() => onSwitch(next), `Discard all pending changes and switch to “${next.title}”?`)
  }

  const refresh = () =>
    guard(
      'Discard pending changes in this table and refresh?',
      () => {
        edits.discardTable(tabs.active)
        view.reload()
      },
      edits.changeCount > 0
    )

  const discard = () => guard('Discard pending changes in this table?', () => edits.discardTable(tabs.active), true)

  const beforeViewChange = (action: () => void) => {
    if (structureSaving || tableActionBusy) return

    edits.stage()
    action()
  }

  const openTable = (table: Table) => beforeViewChange(() => tabs.openTable(table))

  const selectTable = (table: Table) => beforeViewChange(() => tabs.selectTable(table))

  const selectTableMode = (mode: TableMode) => beforeViewChange(() => tabs.selectTableMode(mode))

  const selectQuery = (query: QueryDocument) => beforeViewChange(() => tabs.setActive(`query:${query.id}`))

  const openQuery = (query: QueryDocument) => {
    if (structureSaving || tableActionBusy) return

    edits.stage()
    setError('')
    queries.open(query)
  }

  const newQuery = () => {
    if (structureSaving || tableActionBusy) return

    edits.stage()
    setError('')
    queries.create()
  }

  const newQuickQuery = () => beforeViewChange(() => queries.create(true))

  const closeQuery = (query: QueryDocument) =>
    guard('Discard unsaved changes to this query?', () => queries.dismiss(query), !!queries.dirty[query.id])

  const deleteQuery = (query: QueryDocument) =>
    guard(
      query.isNew ? 'Discard this unsaved query?' : 'Delete this saved query and discard its unsaved changes?',
      () => queries.remove(query),
      query.isNew ? !!queries.dirtyRef.current[query.id] : true
    )

  const openReferenceInTab = () => {
    const reference = references.current?.reference

    if (!reference) return

    beforeViewChange(() => {
      view.presetFilters(tableKey(reference.key.target), referenceFilters(reference))
      tabs.openTable(reference.key.target)
    })
  }

  const toggleSort = (column: string) => beforeViewChange(() => view.toggleSort(column))

  const applyFilters = (rows: TableFilter[]) => beforeViewChange(() => view.applyFilters(rows))

  const clearFilters = () => beforeViewChange(view.clearFilters)

  const removeFilter = (id: string) => beforeViewChange(() => view.removeFilter(id))

  const changePageSize = (size: number) => beforeViewChange(() => view.changePageSize(size))

  const previousPage = () => beforeViewChange(view.previousPage),
    nextPage = () => beforeViewChange(view.nextPage)

  const cancelConfirmation = () => setConfirm(null),
    confirmAction = () => {
      setConfirm(null)
      confirm?.action()
    }

  return {
    id,
    request,
    sidebar,
    setSidebar,
    search,
    setSearch,
    error,
    tableActionBusy,
    tableActionError,
    dismissTableActionError: () => setTableActionError(''),
    copyTableName,
    exportTable,
    exportTables,
    importSql,
    deleteTable,
    dismissError: () => setError(''),
    closing,
    confirm,
    cancelConfirmation,
    confirmAction,
    tables: tabs.tables,
    tabs: tabs.tabs,
    active: tabs.active,
    table: tabs.table,
    tableMode: tabs.tableMode,
    driver: connection?.driver,
    structure: structures[tabs.active],
    structureSaving,
    structureDirty,
    structureRevision,
    setStructure,
    saveStructure,
    selectTableMode,
    refreshTables: tabs.refreshTables,
    openTable,
    selectTable,
    closeTab,
    closeTabs,
    ...view,
    toggleSort,
    applyFilters,
    clearFilters,
    removeFilter,
    changePageSize,
    previousPage,
    nextPage,
    pending: edits.pending,
    editor: edits.editor,
    changeCount: edits.changeCount,
    saving: edits.saving,
    save: edits.save,
    beginEdit: edits.beginEdit,
    addRow: edits.addRow,
    beginNewEdit: edits.beginNewEdit,
    removeNewRow: edits.removeNewRow,
    removeRows: edits.removeRows,
    duplicateSelectedRows: edits.duplicateSelectedRows,
    setCellValue: edits.setCellValue,
    commitCell: edits.commitCell,
    cancelCell: edits.cancelCell,
    nullCell: edits.nullCell,
    reference: references.current,
    referenceDepth: references.depth,
    referenceOrigin: references.origin,
    openReference: references.open,
    followReference: references.follow,
    backReference: references.back,
    closeReference: references.close,
    openReferenceInTab,
    discard,
    refresh,
    closeConnection,
    switchConnection,
    queries: queries.queries,
    queryTabs: queries.tabs,
    querySearch: queries.search,
    setQuerySearch: queries.setSearch,
    queryError: queries.error,
    queryDirty: queries.dirty,
    queryBusy: queries.busy,
    currentQuery: queries.currentQuery,
    anyQueryDirty: queries.anyDirty,
    anyQueryBusy: queries.anyBusy,
    dirtyQuery: queries.markDirty,
    busyQuery: queries.markBusy,
    savedQuery: queries.saved,
    convertQuickQuery: queries.convertQuick,
    openQuery,
    newQuery,
    newQuickQuery,
    selectQuery,
    closeQuery,
    deleteQuery
  }
}

export type WorkspaceController = ReturnType<typeof useWorkspace>
