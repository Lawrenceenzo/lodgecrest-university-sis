import { useState } from 'react'
import { Alert, Box, Button, FormControlLabel, Paper, Switch, TextField, Typography } from '@mui/material'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import { Link as RouterLink } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ToastSnackbar from '../components/ToastSnackbar'
import { FormSelect } from '../components/FormControls'
import FormField from '../components/students/FormField'
import { cardSx } from '../components/tableStyles'
import { useAuth } from '../context/AuthContext'
import { normalizeName, validateDisplayName } from '../utils/account'

const YEARS = ['2026-2027', '2025-2026', '2024-2025'].map((y) => ({ value: y, label: y.replace('-', ' - ') }))
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'].map((s) => ({ value: s, label: s }))

const NOTIFICATIONS = [
  { key: 'email', label: 'Email notifications', hint: 'Receive system updates by email.' },
  { key: 'enrollment', label: 'Enrollment alerts', hint: 'Notify me when a student is enrolled or removed.' },
  { key: 'attendance', label: 'Attendance alerts', hint: 'Notify me about unusually low attendance.' },
]

// Locked fields stay readable: the browser's default for disabled text is too faint.
const lockedSx = { '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: '#5b6477' }, '& .MuiInputBase-root.Mui-disabled': { bgcolor: '#f5f6fa' } }

function Section({ title, description, children }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, md: 3 } }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
        {description}
      </Typography>
      {children}
    </Paper>
  )
}

export default function Settings() {
  const { user, updateName } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [nameTouched, setNameTouched] = useState(false)
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [academic, setAcademic] = useState({ year: '2026-2027', semester: '1st Semester' })
  const [notify, setNotify] = useState({ email: true, enrollment: true, attendance: false })
  const [toast, setToast] = useState(null)

  const handleToggle = (key) => (e) => {
    const { checked } = e.target
    setNotify((s) => ({ ...s, [key]: checked }))
    setToast({ severity: 'success', message: 'Notification preferences updated' })
  }

  const nameError = nameTouched ? validateDisplayName(name) : ''
  const dirty = normalizeName(name) !== (user?.name ?? '')

  // Only the display name can be saved. The other fields are locked (disabled), and the server refuses them too.
  const save = async () => {
    setNameTouched(true)
    setServerError('')
    if (validateDisplayName(name)) {
      document.getElementById('settings-name')?.focus()
      return
    }
    if (!dirty) {
      setToast({ severity: 'info', message: 'There is nothing to save.' })
      return
    }
    setSaving(true)
    try {
      const updated = await updateName(normalizeName(name))
      setName(updated.name)
      setNameTouched(false)
      setToast({ severity: 'success', message: 'Your name was updated.' })
    } catch (err) {
      setServerError(err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Could not save. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Manage your account and system preferences."
        action={
          <Button variant="contained" color="secondary" startIcon={<SaveOutlined />} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Section title="Account" description="You can change your display name. Your sign-in e-mail and role are fixed; ask another administrator to change them.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <FormField id="settings-name" label="Name" required error={nameError}>
              <TextField
                id="settings-name"
                size="small"
                fullWidth
                value={name}
                error={Boolean(nameError)}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setNameTouched(true)}
                helperText={nameError ? undefined : '2 to 60 characters: letters, spaces, apostrophes, hyphens and periods.'}
                slotProps={{ htmlInput: { maxLength: 60, autoComplete: 'name' } }}
              />
            </FormField>
            <FormField id="settings-email" label="Email">
              <TextField id="settings-email" size="small" fullWidth value={user?.email ?? ''} disabled sx={lockedSx} helperText="Login codes are sent to this address, so it cannot be changed here." />
            </FormField>
            <FormField id="settings-role" label="Role">
              <TextField id="settings-role" size="small" fullWidth value={user?.roleLabel ?? ''} disabled sx={lockedSx} />
            </FormField>
            <Button component={RouterLink} to="/change-password" variant="outlined" startIcon={<KeyOutlined />} sx={{ alignSelf: 'flex-start' }}>
              Change password
            </Button>
          </Box>
        </Section>

        <Section title="Academic Period" description="The period shown by default across the system.">
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            <FormSelect
              name="academicYear"
              label="Academic Year"
              options={YEARS}
              value={academic.year}
              onChange={(e) => setAcademic((a) => ({ ...a, year: e.target.value }))}
            />
            <FormSelect
              name="semester"
              label="Current Semester"
              options={SEMESTERS}
              value={academic.semester}
              onChange={(e) => setAcademic((a) => ({ ...a, semester: e.target.value }))}
            />
          </Box>
        </Section>

        <Section title="Notifications" description="Choose which alerts you want to receive.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {NOTIFICATIONS.map((n) => (
              <FormControlLabel
                key={n.key}
                sx={{ alignItems: 'flex-start', m: 0, gap: 1 }}
                control={
                  <Switch
                    checked={notify[n.key]}
                    onChange={handleToggle(n.key)}
                    color="primary"
                    slotProps={{ input: { 'aria-label': n.label } }}
                  />
                }
                label={
                  <Box sx={{ pt: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {n.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {n.hint}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </Box>
        </Section>
      </Box>

      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
