import { useEffect, useRef } from 'react'
import Button from './Button'

// A confirmation modal for the Tailwind screens (the student portal). It uses the browser's own
// <dialog>, so focus stays inside it, Escape cancels, and the page behind it cannot be clicked.
export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-modal-title"
      onCancel={(e) => {
        e.preventDefault() // Escape: let the parent decide, so its state stays in step
        onCancel()
      }}
      onClick={(e) => e.target === ref.current && onCancel()} // a click on the backdrop
      className="m-auto w-[min(92vw,26rem)] rounded-md border border-navy-100 bg-white p-0 text-ink shadow-xl backdrop:bg-navy-950/60"
    >
      <div className="p-6">
        <h2 id="confirm-modal-title" className="font-serif text-xl font-semibold text-navy-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
