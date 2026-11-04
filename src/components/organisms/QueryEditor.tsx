import { useQueryEditor } from '../../hooks/useQueryEditor'
import type { QueryEditorOptions } from '../../hooks/useQueryEditor'
import { ErrorMessage } from '../atoms/ErrorMessage'
import { QueryToolbar } from '../molecules/QueryToolbar'
import { SqlCodeInput } from '../molecules/SqlCodeInput'
import { QueryEditorHint } from '../molecules/QueryEditorHint'
import { QueryResults } from './QueryResults'

type Props = QueryEditorOptions & { onDelete: () => void }

export function QueryEditor(props: Props) {
  const editor = useQueryEditor(props)

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
      <SqlCodeInput value={editor.sql} disabled={!!editor.busy} onChange={editor.setSql} />
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
