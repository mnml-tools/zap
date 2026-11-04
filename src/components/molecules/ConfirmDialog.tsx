import { Button } from '../atoms/Button'

type Props = { message: string; onCancel: () => void; onConfirm: () => void }

export function ConfirmDialog({ message, onCancel, onConfirm }: Props) {
  return (
    <div
      className="overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section className="modal discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
        <div className="modal-heading">
          <h2 id="discard-title">Confirm action</h2>
        </div>
        <p>{message}</p>
        <div className="discard-actions">
          <Button autoFocus onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </div>
      </section>
    </div>
  )
}
