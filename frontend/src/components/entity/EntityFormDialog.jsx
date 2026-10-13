import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { FormInput, FormSelect } from '../FormControls'
import { emptyValues, fieldsFor, validateEntity } from '../../utils/entityForm'

// Generic add / edit dialog driven by a `fields` config. Remounted by the parent on each open.
// `onSubmit(values)` returns a promise: the dialog stays open, with the server's message, if it fails.
export default function EntityFormDialog({ title, submitLabel, fields, initialValues, editing = false, lockedFields = [], onClose, onSubmit }) {
  const shownFields = fieldsFor(fields, editing)
  const [values, setValues] = useState(() => emptyValues(shownFields, initialValues))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const errors = validateEntity(shownFields, values)
  const shown = (name) => (submitted || touched[name] ? errors[name] : undefined)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError('')
    const keys = Object.keys(errors)
    if (keys.length) {
      document.getElementById(keys[0])?.focus()
      return
    }
    setSaving(true)
    try {
      await onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])))
    } catch (err) {
      const data = err.response?.data
      setServerError(data?.errors?.join('. ') || data?.message || 'Could not reach the server. Nothing was saved.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            {shownFields.map((f, i) => {
              const common = {
                name: f.name,
                label: f.label,
                required: f.required,
                value: values[f.name],
                error: shown(f.name),
                disabled: editing && lockedFields.includes(f.name),
                helperText: f.helper,
                onChange: (e) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
                onBlur: () => setTouched((t) => ({ ...t, [f.name]: true })),
              }
              return f.type === 'select' ? (
                <FormSelect key={f.name} {...common} options={f.options} placeholder={f.placeholder} />
              ) : (
                <FormInput
                  key={f.name}
                  {...common}
                  type={f.type === 'email' ? 'email' : 'text'}
                  placeholder={f.placeholder ?? `Enter ${f.label.toLowerCase()}`}
                  autoFocus={i === 0 && !common.disabled}
                  slotProps={f.type === 'number' ? { htmlInput: { inputMode: 'decimal' } } : undefined}
                />
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
