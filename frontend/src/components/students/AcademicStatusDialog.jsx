import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import api from '../../api/axios'
import { ACADEMIC_STATUSES } from '../../utils/lifecycle'
import { fullName } from '../../utils/students'

// Change where a student stands in their academic life. Archiving uses the soft-delete endpoint;
// everything else is a plain status change. Mount only while open.
export default function AcademicStatusDialog({ student, onClose, onChanged }) {
  const current = student.academicStatus || 'Enrolled'
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      if (value === 'Archived') await api.delete(`/students/${student.id}`)
      else await api.patch(`/students/${student.id}/academic-status`, { academicStatus: value })
      onChanged(value)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the status.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change academic status</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {fullName(student)} · {student.studentId}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        <RadioGroup value={value} onChange={(e) => setValue(e.target.value)} aria-label="Academic status">
          {ACADEMIC_STATUSES.map((s) => (
            <FormControlLabel
              key={s.value}
              value={s.value}
              control={<Radio size="small" />}
              sx={{ alignItems: 'flex-start', mb: 0.5 }}
              label={
                <Box sx={{ pt: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {s.label}
                    {s.value === current && ' (current)'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {s.help}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || value === current}>
          {saving ? 'Saving…' : 'Save status'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
