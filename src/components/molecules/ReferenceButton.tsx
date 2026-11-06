import { ArrowUpRight } from 'lucide-react'
import { Button } from '../atoms/Button'

type Props = { title: string; onOpen: () => void }

export function ReferenceButton({ title, onOpen }: Props) {
  return (
    <Button
      type="button"
      className="reference-open"
      title={title}
      aria-label={title}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      <ArrowUpRight size={12} aria-hidden="true" />
    </Button>
  )
}
