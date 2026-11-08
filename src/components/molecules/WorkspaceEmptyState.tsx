import { Table2 } from 'lucide-react'
import { EmptyState, Message } from '@mnml-tools/ui'

export function WorkspaceEmptyState({ error }: { error: string }) {
  return (
    <EmptyState
      icon={<Table2 size={28} strokeWidth={1} />}
      title="No tab selected"
      notice={error && <Message tone="error">{error}</Message>}
    >
      Select a table or query in the sidebar to open a tab.
    </EmptyState>
  )
}
