const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// fields: [{ name, label, type: 'text' | 'email' | 'number' | 'select', required, options?: [{value,label}],
//            min?, max?, integer?, createOnly?, editOnly?, helper? }]
export const emptyValues = (fields, initial = {}) => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? '']))

export function validateEntity(fields, values) {
  const errors = {}
  for (const f of fields) {
    const v = String(values[f.name] ?? '').trim()
    if (f.required && !v) errors[f.name] = `${f.label} is required`
    else if (v && f.type === 'email' && !EMAIL_RE.test(v)) errors[f.name] = 'Enter a valid email address'
    else if (v && f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n)) errors[f.name] = `${f.label} must be a number`
      else if (f.integer && !Number.isInteger(n)) errors[f.name] = `${f.label} must be a whole number`
      else if (f.min !== undefined && n < f.min) errors[f.name] = `${f.label} must be at least ${f.min}`
      else if (f.max !== undefined && n > f.max) errors[f.name] = `${f.label} must be ${f.max} or less`
    } else if (v && f.type !== 'select' && v.length > 80) errors[f.name] = `${f.label} must be 80 characters or fewer`
  }
  return errors
}

// Fields that apply to this dialog: create-only ones are hidden when editing and vice versa.
export const fieldsFor = (fields, editing) => fields.filter((f) => (editing ? !f.createOnly : !f.editOnly))
