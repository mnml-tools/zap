import { Table2 } from 'lucide-react'
import { ErrorMessage } from '../atoms/ErrorMessage'

export function WorkspaceEmptyState({ error }: { error: string }) {
  return (
    <div className="workspace-empty">
      {error && <ErrorMessage message={error} />}
      <Table2 size={28} strokeWidth={1} />
      <h2>No tab selected</h2>
      <p>Select a table or query in the sidebar to open a tab.</p>
    </div>
  )
}
