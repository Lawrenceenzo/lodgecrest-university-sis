const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Mirrors the backend rules in POST /api/auth/register.
export function validateUserForm({ name, email, password, confirmPassword }) {
  const e = {}
  const n = name.trim()
  if (!n) e.name = 'Name is required'
  else if (n.length < 2) e.name = 'Name must be at least 2 characters'
  else if (n.length > 60) e.name = 'Name must be 60 characters or fewer'

  if (!email.trim()) e.email = 'Email is required'
  else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address'

  if (!password) e.password = 'Password is required'
  else if (password.length < 8) e.password = 'Password must be at least 8 characters'
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Use at least one letter and one number'

  if (!confirmPassword) e.confirmPassword = 'Please confirm the password'
  else if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match'

  return e
}
