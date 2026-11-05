import { Ellipsis } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '../atoms/Button'
import { ActionContextMenu } from './ActionContextMenu'

type Props = {
  busy: boolean
  canExport: boolean
  onImport: () => void
  onExport: () => void
}

export function ConnectionTransferMenu({ busy, canExport, onImport, onExport }: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement>()
  const dismiss = useCallback(() => setAnchor(undefined), [])
  const run = (action: () => void) => {
    dismiss()
    action()
  }

  return (
    <>
      <Button
        type="button"
        aria-label="Connection actions"
        title="Connection actions"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        disabled={busy}
        onClick={(event) => setAnchor(anchor ? undefined : event.currentTarget)}
      >
        <Ellipsis size={16} />
      </Button>
      {anchor && (
        <ActionContextMenu
          title="Connections"
          x={anchor.getBoundingClientRect().right - 230}
          y={anchor.getBoundingClientRect().bottom + 4}
          trigger={anchor}
          onDismiss={dismiss}
          actions={[
            { label: 'Import connections…', disabled: busy, run: () => run(onImport) },
            { label: 'Export with passwords…', disabled: busy || !canExport, run: () => run(onExport) }
          ]}
        />
      )}
    </>
  )
}
