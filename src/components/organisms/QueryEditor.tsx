import { useQueryEditor } from '../../hooks/useQueryEditor'
import type { QueryEditorOptions } from '../../hooks/useQueryEditor'
import { useSqlCompletion } from '../../hooks/useSqlCompletion'
import type { Table } from '../../types/table'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { QueryToolbar } from '../molecules/QueryToolbar'
import { SqlCodeInput } from '../molecules/SqlCodeInput'
import { QueryEditorHint } from '../molecules/QueryEditorHint'
import { QueryResults } from './QueryResults'

type Props = QueryEditorOptions & { driver: string; tables: Table[]; onDelete: () => void }

export function QueryEditor(props: Props) {
  const editor = useQueryEditor(props)
  const complete = useSqlCompletion({
    connectionId: props.connectionId,
    driver: props.driver,
    request: props.request,
    tables: props.tables,
    sql: editor.sql
  })

  return (
    <div
      className="query-editor"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          void editor.run()
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          void editor.save()
        }
      }}
    >
      <QueryToolbar
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
      <QueryEditorHint lineCount={editor.sql.split('\n').length} />
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
