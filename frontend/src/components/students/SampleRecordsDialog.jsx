import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material'
import api from '../../api/axios'
import { apiError } from '../../utils/records'
import { fullName } from '../../utils/students'

// Gives a student classes (and, if asked, graded earlier semesters) so their portal has something to show.
export default function SampleRecordsDialog({ student, onClose, onDone }) {
  const [history, setHistory] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post(`/students/${student.id}/sample-records`, { history })
      onDone(`${fullName(student)}: ${data.message}`)
    } catch (err) {
      setError(apiError(err, 'Could not generate the records.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Generate sample records</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {fullName(student)} · {student.studentId} · {student.course || 'no course'} {student.yearLevel}, Section {student.section || '-'}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Enrolls the student in this term&apos;s standard subjects for their course and year, with schedules that do not clash. Anything they already have is left alone.
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={history} onChange={(e) => setHistory(e.target.checked)} />}
          label={<Typography variant="body2">Also add earlier semesters, completed with sample grades</Typography>}
        />
        {history && (
          <Alert severity="info" sx={{ mt: 1 }}>
            The grades are generated demo data, not real results. They are marked on the profile and can be removed again.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={run} disabled={saving}>
          {saving ? 'Generating…' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
