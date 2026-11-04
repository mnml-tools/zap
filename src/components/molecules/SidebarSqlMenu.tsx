import { Ellipsis } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '../atoms/Button'
import { ActionContextMenu } from './ActionContextMenu'

type Props = {
  disabled: boolean
  importDisabled: boolean
  onImport: () => void
  onExportTables?: () => void
  onExport?: () => void
}

export function SidebarSqlMenu({ disabled, importDisabled, onImport, onExport, onExportTables }: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement>()
  const dismiss = useCallback(() => setAnchor(undefined), [])
  const run = (action?: () => void) => {
    dismiss()
    action?.()
  }

  return (
    <>
      <Button
        type="button"
        className="sidebar-more"
        aria-label="More database actions"
        title="More database actions"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        disabled={disabled}
        onClick={(event) => setAnchor(anchor ? undefined : event.currentTarget)}
      >
        <Ellipsis size={16} aria-hidden="true" />
      </Button>
      {anchor && (
        <ActionContextMenu
          title="Database"
          x={anchor.getBoundingClientRect().right - 230}
          y={anchor.getBoundingClientRect().top - 4}
          above
          trigger={anchor}
          onDismiss={dismiss}
          actions={[
            { label: 'Import SQL…', disabled: disabled || importDisabled, run: () => run(onImport) },
            { label: 'Export active table as SQL…', disabled: disabled || !onExport, run: () => run(onExport) },
            { label: 'Export tables…', disabled: disabled || !onExportTables, run: () => run(onExportTables) }
          ]}
        />
      )}
    </>
  )
}
