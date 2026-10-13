import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import api from '../../api/axios'
import { FormInput } from '../FormControls'
import { validateUserForm } from '../../utils/userForm'

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' }

// Remounted by the parent each time it opens, so the form always starts clean.
export default function AddUserDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const errors = validateUserForm(form)
  const shown = (name) => (submitted || touched[name] ? errors[name] : undefined)

  const bind = (name) => ({
    name,
    value: form[name],
    error: shown(name),
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
  })

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
      const { data } = await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      onCreated(data)
    } catch (err) {
      setServerError(
        err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Could not reach the server. Is the backend running?',
      )
      setSaving(false)
    }
  }

  const eye = (
    <InputAdornment position="end">
      <IconButton
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => setShowPassword((s) => !s)}
        edge="end"
        size="small"
      >
        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
    </InputAdornment>
  )

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ fontWeight: 700 }}>Add User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <FormInput label="Name" required placeholder="Enter full name" autoComplete="name" autoFocus {...bind('name')} />
            <FormInput
              label="Email"
              required
              type="email"
              placeholder="Enter email address"
              autoComplete="off"
              {...bind('email')}
            />
            <FormInput
              label="Password"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters, with a letter and a number"
              autoComplete="new-password"
              slotProps={{ input: { endAdornment: eye } }}
              {...bind('password')}
            />
            <FormInput
              label="Confirm Password"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter the password"
              autoComplete="new-password"
              {...bind('confirmPassword')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {saving ? 'Creating…' : 'Create User'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
