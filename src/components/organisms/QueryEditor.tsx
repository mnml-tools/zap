import { editorPreferences } from '../../services/editorPreferences'
import { queryNeedsConfirmation } from '../../lib/queryConfirmation'
import { useAppShortcut } from '../../hooks/useAppShortcut'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQueryEditor } from '../../hooks/useQueryEditor'
import type { QueryEditorOptions } from '../../hooks/useQueryEditor'
import { useSqlCompletion } from '../../hooks/useSqlCompletion'
import type { Table } from '../../types/table'
import { runQueryShortcut, saveChangesShortcut } from '../../lib/shortcuts'
import { previewResult } from '../../lib/tabPreview'
import type { PreviewStore, QueryPreview } from '../../lib/tabPreview'
import { ConfirmDialog, Message } from '@mnml-tools/ui'
import { QueryToolbar } from '../molecules/QueryToolbar'
import { SqlCodeInput } from '../molecules/SqlCodeInput'
import { QueryEditorHint } from '../molecules/QueryEditorHint'
import { QueryParameters } from '../molecules/QueryParameters'
import { QueryResults } from './QueryResults'

type Props = QueryEditorOptions & {
  active: boolean
  driver: string
  tables: Table[]
  previews: PreviewStore<QueryPreview>
  onDelete: () => void
}

export function QueryEditor(props: Props) {
  const editor = useQueryEditor(props)
  const preferences = useSyncExternalStore(editorPreferences.subscribe, editorPreferences.getSnapshot)
  const [confirmRun, setConfirmRun] = useState(false)
  const run = () => {
    if (preferences.confirmChanges && queryNeedsConfirmation(editor.sql)) setConfirmRun(true)
    else void editor.run()
  }
  const complete = useSqlCompletion({
    connectionId: props.connectionId,
    driver: props.driver,
    request: props.request,
    tables: props.tables,
    sql: editor.sql
  })
  const preview = useRef<() => QueryPreview>(undefined)
  preview.current = () => ({
    sql: editor.sql,
    running: editor.busy === 'run',
    error: editor.error,
    result: previewResult(editor.result, editor.resultIndex)
  })

  useEffect(
    () => props.previews.register(`query:${props.query.id}`, () => preview.current!()),
    [props.previews, props.query.id]
  )

  // Typing needs no notice because the switcher is never open while the editor has the keyboard.
  useEffect(props.previews.changed, [editor.busy, editor.result, editor.error, editor.resultIndex])

  useAppShortcut(
    saveChangesShortcut,
    !props.query.quick && props.active && editor.dirty && !editor.busy && !!editor.title.trim() && !!editor.sql.trim(),
    editor.save
  )

  useAppShortcut(runQueryShortcut, props.active && !editor.busy && !!editor.sql.trim(), run)

  return (
    <div className="query-editor">
      {confirmRun && (
        <ConfirmDialog
          title="Run query?"
          message="This SQL contains statements that can change data or database structure. Run it against the current connection?"
          confirmLabel="Run query"
          onCancel={() => setConfirmRun(false)}
          onConfirm={() => {
            setConfirmRun(false)
            void editor.run()
          }}
        />
      )}
      <QueryToolbar
        quick={!!props.query.quick}
        canConvertQuick={!!editor.result}
        onConvertQuick={editor.convertQuick}
        title={editor.title}
        sql={editor.sql}
        dirty={editor.dirty}
        busy={editor.busy}
        onTitleChange={editor.setTitle}
        onSave={editor.save}
        onRun={run}
        onDelete={props.onDelete}
      />
      <SqlCodeInput value={editor.sql} disabled={!!editor.busy} onChange={editor.setSql} complete={complete} />
      <QueryParameters parameters={editor.parameters} disabled={!!editor.busy} onChange={editor.setParameter} />
      <QueryEditorHint quick={!!props.query.quick} unsaved={editor.unsaved} lineCount={editor.sql.split('\n').length} />
      {editor.error && <Message tone="error">{editor.error}</Message>}
      <QueryResults
        running={editor.busy === 'run'}
        result={editor.result}
        active={editor.resultIndex}
        onSelect={editor.setResultIndex}
      />
    </div>
  )
}
