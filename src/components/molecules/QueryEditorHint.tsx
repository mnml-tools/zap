import { formatAppShortcut, useShortcutPreferences } from '../../hooks/useAppShortcut'
import { runQueryShortcut, saveChangesShortcut } from '../../lib/shortcuts'
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
  useShortcutPreferences()

  return (
    <div className="query-hint">
      <span>
        {unsaved && (
          <>
            Run without saving
            <Separator />
          </>
        )}
        {formatAppShortcut(runQueryShortcut)} to run
        {!quick && (
          <>
            <Separator />
            {formatAppShortcut(saveChangesShortcut)} to save
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
