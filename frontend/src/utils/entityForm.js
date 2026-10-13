const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// fields: [{ name, label, type: 'text' | 'email' | 'select', required, options?: [{value,label}] }]
export const emptyValues = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']))

export function validateEntity(fields, values) {
  const errors = {}
  for (const f of fields) {
    const v = String(values[f.name] ?? '').trim()
    if (f.required && !v) errors[f.name] = `${f.label} is required`
    else if (v && f.type === 'email' && !EMAIL_RE.test(v)) errors[f.name] = 'Enter a valid email address'
    else if (v && f.type !== 'select' && v.length > 80) errors[f.name] = `${f.label} must be 80 characters or fewer`
  }
  return errors
}
