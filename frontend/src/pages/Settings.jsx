import { useState } from 'react'
import { Box, Button, FormControlLabel, Paper, Switch, TextField, Typography } from '@mui/material'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import { Link as RouterLink } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ToastSnackbar from '../components/ToastSnackbar'
import { FormSelect } from '../components/FormControls'
import FormField from '../components/students/FormField'
import { cardSx } from '../components/tableStyles'
import { useAuth } from '../context/AuthContext'

const YEARS = ['2026-2027', '2025-2026', '2024-2025'].map((y) => ({ value: y, label: y.replace('-', ' - ') }))
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'].map((s) => ({ value: s, label: s }))

const NOTIFICATIONS = [
  { key: 'email', label: 'Email notifications', hint: 'Receive system updates by email.' },
  { key: 'enrollment', label: 'Enrollment alerts', hint: 'Notify me when a student is enrolled or removed.' },
  { key: 'attendance', label: 'Attendance alerts', hint: 'Notify me about unusually low attendance.' },
]

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
  const { user } = useAuth()
  const [academic, setAcademic] = useState({ year: '2026-2027', semester: '1st Semester' })
  const [notify, setNotify] = useState({ email: true, enrollment: true, attendance: false })
  const [toast, setToast] = useState(null)

  const handleToggle = (key) => (e) => {
    const { checked } = e.target
    setNotify((s) => ({ ...s, [key]: checked }))
    setToast({ severity: 'success', message: 'Notification preferences updated' })
  }

  const readOnly = { input: { readOnly: true } }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Manage your account and system preferences."
        action={
          <Button variant="contained" color="secondary" startIcon={<SaveOutlined />} onClick={() => setToast({ severity: 'success', message: 'Settings saved.' })}>
            Save Changes
          </Button>
        }
      />

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Section title="Account" description="Your sign-in details. Contact another administrator to change them.">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormField id="settings-name" label="Name">
              <TextField id="settings-name" size="small" fullWidth value={user?.name ?? ''} slotProps={readOnly} />
            </FormField>
            <FormField id="settings-email" label="Email">
              <TextField id="settings-email" size="small" fullWidth value={user?.email ?? ''} slotProps={readOnly} />
            </FormField>
            <FormField id="settings-role" label="Role">
              <TextField id="settings-role" size="small" fullWidth value={user?.roleLabel ?? ''} slotProps={readOnly} />
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
