import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import api from '../../../api/axios'
import { FormInput, FormSelect } from '../../FormControls'
import { apiError, CHARGE_CATEGORIES, HOLD_TYPES, PAYMENT_METHODS, todayISO } from '../../../utils/records'

// Shared frame: title, error, form fields, Cancel / Save. `submit` returns a promise; resolve to close.
function FormDialog({ title, submitLabel, busyLabel, canSubmit, submit, onClose, children }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await submit()
    } catch (err) {
      setError(apiError(err, 'Could not save.'))
      setSaving(false)
    }
  }
  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={(e) => e.preventDefault()} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || !canSubmit}>
          {saving ? busyLabel : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const moneyOk = (v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0
const moneyInput = { htmlInput: { inputMode: 'decimal' } }
const termOptions = (terms) => [{ value: '', label: 'No specific term' }, ...terms.map((t) => ({ value: t.id, label: t.name + (t.isCurrent ? ' (current)' : '') }))]

export function ChargeDialog({ student, terms, onClose, onSaved }) {
  const [category, setCategory] = useState('Tuition')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [termId, setTermId] = useState(terms.find((t) => t.isCurrent)?.id ?? '')
  const [dueDate, setDueDate] = useState('')
  return (
    <FormDialog
      title="Add a charge"
      submitLabel="Add charge"
      busyLabel="Saving…"
      canSubmit={description.trim() !== '' && moneyOk(amount)}
      onClose={onClose}
      submit={async () => {
        await api.post(`/students/${student.id}/charges`, { category, description: description.trim(), amount: Number(amount), termId: termId || undefined, dueDate: dueDate || undefined })
        onSaved('Charge added.')
      }}
    >
      <FormSelect name="category" label="Category" required value={category} onChange={(e) => setCategory(e.target.value)} options={CHARGE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <FormInput name="description" label="Description" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Tuition, 17 units" slotProps={{ htmlInput: { maxLength: 120 } }} />
      <FormInput name="amount" label="Amount (PHP)" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" error={amount && !moneyOk(amount) ? 'Enter an amount with at most 2 decimals' : ''} slotProps={moneyInput} />
      <FormSelect name="term" label="Term" value={termId} onChange={(e) => setTermId(e.target.value)} options={termOptions(terms)} />
      <FormInput name="dueDate" label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
    </FormDialog>
  )
}

export function PaymentDialog({ student, terms, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [receiptNo, setReceiptNo] = useState('')
  const [termId, setTermId] = useState(terms.find((t) => t.isCurrent)?.id ?? '')
  const [paidAt, setPaidAt] = useState(todayISO())
  const [note, setNote] = useState('')
  return (
    <FormDialog
      title="Record a payment"
      submitLabel="Record payment"
      busyLabel="Saving…"
      canSubmit={moneyOk(amount) && Boolean(paidAt)}
      onClose={onClose}
      submit={async () => {
        await api.post(`/students/${student.id}/payments`, { amount: Number(amount), method, receiptNo: receiptNo.trim() || undefined, termId: termId || undefined, paidAt, note: note.trim() || undefined })
        onSaved('Payment recorded.')
      }}
    >
      <FormInput name="amount" label="Amount (PHP)" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" error={amount && !moneyOk(amount) ? 'Enter an amount with at most 2 decimals' : ''} slotProps={moneyInput} />
      <FormSelect name="method" label="Method" required value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
      <FormInput name="receiptNo" label="Receipt number" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="Optional, must be unique" slotProps={{ htmlInput: { maxLength: 40 } }} />
      <FormInput name="paidAt" label="Date paid" required type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      <FormSelect name="term" label="Term" value={termId} onChange={(e) => setTermId(e.target.value)} options={termOptions(terms)} />
      <FormInput name="note" label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" slotProps={{ htmlInput: { maxLength: 200 } }} />
    </FormDialog>
  )
}

export function HoldDialog({ student, activeTypes, onClose, onSaved }) {
  const available = HOLD_TYPES.filter((t) => !activeTypes.includes(t))
  const [type, setType] = useState(available[0] ?? '')
  const [reason, setReason] = useState('')
  return (
    <FormDialog
      title="Place a hold"
      submitLabel="Place hold"
      busyLabel="Saving…"
      canSubmit={Boolean(type) && reason.trim() !== ''}
      onClose={onClose}
      submit={async () => {
        await api.post(`/students/${student.id}/holds`, { type, reason: reason.trim() })
        onSaved(`${type} hold placed.`)
      }}
    >
      {available.length === 0 && <Alert severity="info">This student already has an active hold of every type.</Alert>}
      <FormSelect name="type" label="Hold type" required value={type} onChange={(e) => setType(e.target.value)} options={available.map((t) => ({ value: t, label: t }))} />
      <FormInput name="reason" label="Reason" required multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this hold being placed?" slotProps={{ htmlInput: { maxLength: 200 } }} />
    </FormDialog>
  )
}
