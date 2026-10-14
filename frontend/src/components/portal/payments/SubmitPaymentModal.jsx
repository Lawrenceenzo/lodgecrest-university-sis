import { useEffect, useMemo, useState } from 'react'
import api from '../../../api/axios'
import Alert from '../../ui/Alert'
import Button from '../../ui/Button'
import Modal from '../../ui/Modal'
import TextField from '../../ui/TextField'
import { peso, todayISO } from '../../../utils/records'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png']

// The student's "Submit Payment" form: amount, method, reference number, date and a photo of the receipt.
export default function SubmitPaymentModal({ methods, balance, onClose, onSubmitted }) {
  const [form, setForm] = useState({ amount: '', method: methods[0] ?? '', referenceNo: '', paidOn: todayISO(), note: '' })
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const validate = () => {
    const e = {}
    const amount = form.amount.trim()
    if (!amount) e.amount = 'Enter the amount you paid'
    else if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) e.amount = 'Use a positive amount with at most 2 decimals, e.g. 1500.50'
    else if (Number(amount) > 500000) e.amount = 'The amount must be 500,000 or less'
    if (!form.method) e.method = 'Choose how you paid'
    if (!form.referenceNo.trim()) e.referenceNo = 'Enter the reference number from your receipt'
    else if (!/^[A-Za-z0-9-]{4,40}$/.test(form.referenceNo.trim())) e.referenceNo = 'Use 4 to 40 letters, digits or hyphens (no spaces)'
    if (!form.paidOn) e.paidOn = 'Choose the date you paid'
    else if (form.paidOn > todayISO()) e.paidOn = 'The date cannot be in the future'
    if (!file) e.proof = 'Attach a photo or screenshot of your receipt'
    else if (!ALLOWED.includes(file.type)) e.proof = 'The proof must be a JPG or PNG image'
    else if (file.size > MAX_BYTES) e.proof = 'The image must be 5 MB or smaller'
    return e
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setServerError('')
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    const body = new FormData()
    body.append('amount', form.amount.trim())
    body.append('method', form.method)
    body.append('referenceNo', form.referenceNo.trim())
    body.append('paidOn', form.paidOn)
    body.append('note', form.note.trim())
    body.append('proof', file)
    setSaving(true)
    try {
      await api.post('/portal/payments', body) // the browser sets the multipart header
      onSubmitted()
    } catch (err) {
      const data = err.response?.data
      setServerError(data?.errors?.join('. ') || data?.message || 'Could not reach the server. Nothing was sent.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Submit a payment" subtitle="Send in your receipt. The Registrar's office checks it and records the payment." onClose={onClose} busy={saving}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        {balance > 0 && <p className="rounded border border-navy-100 bg-navy-50 px-3 py-2 text-sm text-navy-900">Your balance is <strong>{peso(balance)}</strong>.</p>}

        <TextField label="Amount paid (PHP)" inputMode="decimal" autoFocus value={form.amount} onChange={set('amount')} placeholder="e.g. 1500.00" error={errors.amount} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-method" className="text-sm font-semibold text-ink">
            Payment method
          </label>
          <select
            id="pay-method"
            value={form.method}
            onChange={set('method')}
            aria-invalid={Boolean(errors.method)}
            className="rounded border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink focus-visible:border-navy-700 focus-visible:outline-2 focus-visible:outline-gold-500/40"
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.method && <p className="text-xs text-red-700">{errors.method}</p>}
        </div>

        <TextField label="Reference number" value={form.referenceNo} onChange={set('referenceNo')} placeholder="From your receipt or confirmation" error={errors.referenceNo} autoComplete="off" />
        <TextField label="Date paid" type="date" value={form.paidOn} max={todayISO()} onChange={set('paidOn')} error={errors.paidOn} />
        <TextField label="Note (optional)" value={form.note} onChange={set('note')} maxLength={200} placeholder="e.g. Tuition, first installment" />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-proof" className="text-sm font-semibold text-ink">
            Proof of payment
          </label>
          <input
            id="pay-proof"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setErrors((x) => ({ ...x, proof: undefined }))
            }}
            aria-invalid={Boolean(errors.proof)}
            className="block w-full rounded border border-dashed border-slate-300 bg-navy-50 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-800"
          />
          <p className="text-xs text-muted">A photo or screenshot of your receipt. JPG or PNG, up to 5 MB.</p>
          {errors.proof && <p className="text-xs text-red-700">{errors.proof}</p>}
          {preview && <img src={preview} alt="Preview of your proof of payment" className="mt-1 max-h-48 self-start rounded border border-navy-100 object-contain" />}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" loading={saving}>
            Submit payment
          </Button>
        </div>
      </form>
    </Modal>
  )
}
