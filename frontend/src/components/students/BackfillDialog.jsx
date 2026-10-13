import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Skeleton, Typography } from '@mui/material'
import api from '../../api/axios'
import { useApiData } from '../../hooks/useApiData'
import { apiError } from '../../utils/records'

// One step for every enrolled student who has no classes yet (their portal would be empty).
export default function BackfillDialog({ onClose, onDone }) {
  const pending = useApiData('/sample-records/pending')
  const [history, setHistory] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { data } = pending

  const run = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: result } = await api.post('/sample-records/backfill', { history })
      onDone(`Sample records were added for ${result.succeeded} of ${result.processed} students.`)
    } catch (err) {
      setError(apiError(err, 'Could not generate the records.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Fill in empty records</DialogTitle>
      <DialogContent>
        {pending.error && <Alert severity="error">{pending.error}</Alert>}
        {!data && !pending.error && <Skeleton variant="rounded" height={80} />}
        {data && data.count === 0 && <Alert severity="success">Every enrolled student already has classes. Nothing to do.</Alert>}
        {data && data.count > 0 && (
          <>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {data.count} enrolled {data.count === 1 ? 'student has' : 'students have'} no classes, so their portal shows empty pages:
            </Typography>
            <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, maxHeight: 160, overflowY: 'auto', fontSize: 14 }}>
              {data.students.map((s) => (
                <li key={s.id}>
                  {s.name} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>({s.studentId} · {s.course} {s.yearLevel})</Typography>
                </li>
              ))}
            </Box>
            <FormControlLabel
              control={<Checkbox checked={history} onChange={(e) => setHistory(e.target.checked)} />}
              label={<Typography variant="body2">Include earlier semesters with sample grades (demo data)</Typography>}
            />
          </>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          {data?.count === 0 ? 'Close' : 'Cancel'}
        </Button>
        {data?.count > 0 && (
          <Button variant="contained" onClick={run} disabled={saving}>
            {saving ? 'Working…' : `Generate for ${data.count}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
