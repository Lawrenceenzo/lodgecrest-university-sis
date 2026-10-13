import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { FormInput, FormSelect } from '../FormControls'
import { emptyValues, validateEntity } from '../../utils/entityForm'

// Generic "Add ..." dialog driven by a `fields` config. Remounted by the parent on each open.
export default function EntityFormDialog({ title, submitLabel, fields, onClose, onSubmit }) {
  const [values, setValues] = useState(() => emptyValues(fields))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const errors = validateEntity(fields, values)
  const shown = (name) => (submitted || touched[name] ? errors[name] : undefined)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      document.getElementById(keys[0])?.focus()
      return
    }
    onSubmit(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])))
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {fields.map((f, i) => {
              const common = {
                name: f.name,
                label: f.label,
                required: f.required,
                value: values[f.name],
                error: shown(f.name),
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
                  autoFocus={i === 0}
                />
              )
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
