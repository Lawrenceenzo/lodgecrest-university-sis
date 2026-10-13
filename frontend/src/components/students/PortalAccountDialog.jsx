import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import api from '../../api/axios'
import { fullName } from '../../utils/students'

// Lets an admin give a student a portal login. The server generates a one-time temporary password
// that is shown here once; the student must replace it at their first sign-in.
export default function PortalAccountDialog({ student, onClose }) {
  const [account, setAccount] = useState(null) // { exists, email?, mustChangePassword? }
  const [loadError, setLoadError] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState('') // present only right after create / reset
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get(`/students/${student.id}/account`)
      .then((res) => !cancelled && setAccount(res.data))
      .catch((err) => !cancelled && setLoadError(err.response?.data?.message || 'Could not load the account.'))
    return () => {
      cancelled = true
    }
  }, [student.id])

  const run = async (request) => {
    setWorking(true)
    setError('')
    try {
      const { data } = await request()
      if (data.account) setAccount(data.account)
      else setAccount((a) => ({ ...a, mustChangePassword: true }))
      setTempPassword(data.temporaryPassword)
      setCopied(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const create = () => run(() => api.post(`/students/${student.id}/account`))
  const reset = () => run(() => api.post(`/students/${student.id}/account/reset-password`))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
    } catch {
      setError('Could not copy automatically. Select the password and copy it by hand.')
    }
  }

  return (
    <Dialog open onClose={working ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Student portal account</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {fullName(student)} · {student.studentId}
        </Typography>

        {loadError && <Alert severity="error">{loadError}</Alert>}
        {!account && !loadError && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {tempPassword && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Give this temporary password to the student now. It will <strong>not be shown again</strong>, and they must change it when they first sign in.
            </Alert>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                component="code"
                aria-label="Temporary password"
                sx={{ flex: 1, bgcolor: '#f1f4fa', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1, fontSize: 18, letterSpacing: 1.5, userSelect: 'all' }}
              >
                {tempPassword}
              </Box>
              <Button variant="outlined" startIcon={<ContentCopyOutlined />} onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Box>
          </Box>
        )}

        {account && !account.exists && (
          <Typography variant="body2">
            This student has no portal login yet. Creating one lets them sign in with <strong>{student.email}</strong> (a verification code is e-mailed to that address each time).
          </Typography>
        )}

        {account?.exists && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, fontSize: 14 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sign-in e-mail
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {account.email}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Status
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {account.mustChangePassword ? 'Waiting for first sign-in' : 'Active'}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={working}>
          {tempPassword ? 'Done' : 'Close'}
        </Button>
        {account && !account.exists && (
          <Button variant="contained" onClick={create} disabled={working}>
            {working ? 'Creating…' : 'Create portal account'}
          </Button>
        )}
        {account?.exists && !tempPassword && (
          <Button variant="outlined" color="warning" onClick={reset} disabled={working}>
            {working ? 'Resetting…' : 'Reset password'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
