import { useQueryEditor } from '../../hooks/useQueryEditor'
import type { QueryEditorOptions } from '../../hooks/useQueryEditor'
import { useSqlCompletion } from '../../hooks/useSqlCompletion'
import type { Table } from '../../types/table'
import { useShortcut } from '../../hooks/useShortcut'
import { saveChangesShortcut } from '../../lib/shortcuts'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { QueryToolbar } from '../molecules/QueryToolbar'
import { SqlCodeInput } from '../molecules/SqlCodeInput'
import { QueryEditorHint } from '../molecules/QueryEditorHint'
import { QueryParameters } from '../molecules/QueryParameters'
import { QueryResults } from './QueryResults'

type Props = QueryEditorOptions & { active: boolean; driver: string; tables: Table[]; onDelete: () => void }

export function QueryEditor(props: Props) {
  const editor = useQueryEditor(props)
  const complete = useSqlCompletion({
    connectionId: props.connectionId,
    driver: props.driver,
    request: props.request,
    tables: props.tables,
    sql: editor.sql
  })

  useShortcut(
    saveChangesShortcut,
    !props.query.quick && props.active && editor.dirty && !editor.busy && !!editor.title.trim() && !!editor.sql.trim(),
    editor.save
  )

  return (
    <div
      className="query-editor"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          void editor.run()
        }
      }}
    >
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
        onRun={editor.run}
        onDelete={props.onDelete}
      />
      <SqlCodeInput value={editor.sql} disabled={!!editor.busy} onChange={editor.setSql} complete={complete} />
      <QueryParameters parameters={editor.parameters} disabled={!!editor.busy} onChange={editor.setParameter} />
      <QueryEditorHint quick={!!props.query.quick} unsaved={editor.unsaved} lineCount={editor.sql.split('\n').length} />
      {editor.error && <ErrorMessage message={editor.error} />}
      <QueryResults
        running={editor.busy === 'run'}
        result={editor.result}
        active={editor.resultIndex}
        onSelect={editor.setResultIndex}
      />
    </div>
  )
}
