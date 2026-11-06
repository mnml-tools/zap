export function QueryEditorHint({ lineCount }: { lineCount: number }) {
  return (
    <div className="query-hint">
      <span>
        ⌘/Ctrl+Enter to run<span className="footer-dot">·</span>⌘/Ctrl+S to save<span className="footer-dot">·</span>
        Ctrl+Space for suggestions
      </span>
      <span>{lineCount} lines</span>
    </div>
  )
}
