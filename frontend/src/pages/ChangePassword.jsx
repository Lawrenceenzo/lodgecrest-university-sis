import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'
import TextField from '../components/ui/TextField'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { homeFor } from '../utils/roles'

// Mirrors the server's rules (utils/password.js).
function validate({ current, next, confirm }) {
  const e = {}
  if (!current) e.current = 'Enter your current password'
  if (!next) e.next = 'Enter a new password'
  else if (next.length < 8) e.next = 'Use at least 8 characters'
  else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) e.next = 'Include at least one letter and one number'
  else if (next === current) e.next = 'Choose a password different from the current one'
  if (!confirm) e.confirm = 'Re-enter the new password'
  else if (confirm !== next) e.confirm = 'The passwords do not match'
  return e
}

// Used for the forced change after an admin issues a temporary password, and by anyone who
// simply wants to change theirs.
export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const forced = Boolean(user?.mustChangePassword)
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const errors = validate(form)
  const bind = (name) => ({
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    error: submitted ? errors[name] : undefined,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setError('')
    if (Object.keys(errors).length) return
    setSaving(true)
    try {
      const updated = await changePassword(form.current, form.next)
      navigate(homeFor(updated), { replace: true })
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Could not reach the server.')
      setSaving(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-navy-50 p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="mx-auto rounded-md bg-navy-900 px-5 py-4">
          <Logo size={34} />
        </div>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5 rounded-md border border-navy-100 bg-white p-8 shadow-lg shadow-navy-900/10"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-700">{forced ? 'Action required' : 'Account'}</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-navy-900">{forced ? 'Set your password' : 'Change password'}</h1>
            <p className="mt-1 text-sm text-muted">
              {forced
                ? 'You signed in with a temporary password. Choose a new one to continue.'
                : 'Choose a new password for your account.'}
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <TextField
            label={forced ? 'Temporary password' : 'Current password'}
            type="password"
            autoComplete="current-password"
            autoFocus
            {...bind('current')}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters, with a letter and a number"
            {...bind('next')}
          />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" {...bind('confirm')} />

          <Button type="submit" loading={saving} className="w-full py-3">
            Save password
          </Button>

          {forced ? (
            <Button variant="link" onClick={() => setConfirmingLogout(true)} className="self-center text-sm font-normal">
              Sign out instead
            </Button>
          ) : (
            <Button variant="link" onClick={() => navigate(homeFor(user))} className="self-center text-sm font-normal">
              Cancel
            </Button>
          )}
        </form>
      </div>
      <ConfirmModal
        open={confirmingLogout}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={logout}
      />
    </main>
  )
}
