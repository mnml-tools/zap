import { useEffect, useId, useRef } from 'react'
import { isDialogBackdropClick } from '../../lib/dialog'
import { Button } from '../atoms/Button'

type Props = { title: string; message: string; onDismiss: () => void }

export function ErrorDialog({ title, message, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const element = dialog.current!
    element.showModal()

    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal discard-dialog error-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClick={(event) => {
        if (isDialogBackdropClick(event)) onDismiss()
      }}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
      </div>
      <p id={messageId}>{message}</p>
      <div className="discard-actions">
        <Button autoFocus onClick={onDismiss}>
          OK
        </Button>
      </div>
    </dialog>
  )
}
