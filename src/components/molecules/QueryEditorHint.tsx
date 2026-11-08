import { Separator } from '@mnml-tools/ui'

export function QueryEditorHint({
  lineCount,
  unsaved,
  quick
}: {
  lineCount: number
  unsaved: boolean
  quick: boolean
}) {
  return (
    <div className="query-hint">
      <span>
        {unsaved && (
          <>
            Run without saving
            <Separator />
          </>
        )}
        ⌘/Ctrl+Enter to run
        {!quick && (
          <>
            <Separator />
            ⌘/Ctrl+S to save
          </>
        )}
        <Separator />
        Ctrl+Space for suggestions
        <Separator />
        :name for parameters
      </span>
      <span>{lineCount} lines</span>
    </div>
  )
}
