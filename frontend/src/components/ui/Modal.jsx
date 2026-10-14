import { useEffect, useRef } from 'react'

// A dialog for the Tailwind screens, built on the browser's own <dialog>: focus stays inside it, Escape closes it
// and the page behind cannot be clicked. `onClose` is called for Escape and for a click on the dark backdrop.
// Mount it only while it is needed (the parent decides), so its form starts fresh each time.
export default function Modal({ title, subtitle, onClose, children, wide = false, busy = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
      className={`m-auto max-h-[92vh] ${wide ? 'w-[min(94vw,44rem)]' : 'w-[min(94vw,30rem)]'} overflow-y-auto rounded-md border border-navy-100 bg-white p-0 text-ink shadow-xl backdrop:bg-navy-950/60`}
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="modal-title" className="font-serif text-xl font-semibold text-navy-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded text-slate-500 hover:bg-navy-50 hover:text-navy-900 disabled:opacity-40">
            &times;
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
