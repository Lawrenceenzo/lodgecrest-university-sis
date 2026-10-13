// Rules for the one account field an administrator may edit (mirrors PATCH /api/auth/me).
const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u

export const normalizeName = (raw) => raw.trim().replace(/\s+/g, ' ')

// Returns an error message, or '' when the name is fine.
export function validateDisplayName(raw) {
  const name = normalizeName(raw)
  if (!name) return 'Name is required'
  if (name.length < 2) return 'Name must be at least 2 characters'
  if (name.length > 60) return 'Name must be 60 characters or fewer'
  if (!NAME_RE.test(name)) return 'Use letters, spaces, apostrophes, hyphens and periods only'
  return ''
}
