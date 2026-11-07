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
            Run without saving<span className="footer-dot">·</span>
          </>
        )}
        ⌘/Ctrl+Enter to run
        {!quick && (
          <>
            <span className="footer-dot">·</span>⌘/Ctrl+S to save
          </>
        )}
        <span className="footer-dot">·</span>Ctrl+Space for suggestions
        <span className="footer-dot">·</span>:name for parameters
      </span>
      <span>{lineCount} lines</span>
    </div>
  )
}
