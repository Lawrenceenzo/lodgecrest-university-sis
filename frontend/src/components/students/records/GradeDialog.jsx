import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import api from '../../../api/axios'
import { FormSelect } from '../../FormControls'
import { apiError, GRADE_MARKS, GRADE_VALUES, gradeValueLabel } from '../../../utils/records'

// Enter or correct the final grade of one class: a numeric grade, or INC / DRP / W.
// DRP and W end the class, so they are only offered while it is still in progress.
export default function GradeDialog({ row, onClose, onSaved }) {
  const existing = row.grade
  const [kind, setKind] = useState(existing?.mark ? 'mark' : 'value')
  const [value, setValue] = useState(existing?.value != null ? String(existing.value) : '')
  const [mark, setMark] = useState(existing?.mark ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inProgress = row.status === 'Enrolled'
  const marks = GRADE_MARKS.filter((m) => inProgress || !m.dropsClass)
  const ready = kind === 'value' ? value !== '' : mark !== ''
  const picked = GRADE_MARKS.find((m) => m.value === mark)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/enrollments/${row.id}/grade`, kind === 'value' ? { value: Number(value) } : { mark })
      onSaved(row, kind === 'value' ? Number(value).toFixed(2) : mark)
    } catch (err) {
      setError(apiError(err, 'Could not save the grade.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{existing ? 'Edit grade' : 'Enter grade'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {row.subject.code} · {row.subject.title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          {row.term.name} · {row.subject.units} units{row.subject.countsToGwa ? '' : ' · not counted in the GWA'}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        <RadioGroup row value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Grade type" sx={{ mb: 1.5 }}>
          <FormControlLabel value="value" control={<Radio size="small" />} label="Numeric grade" />
          <FormControlLabel value="mark" control={<Radio size="small" />} label="Mark" />
        </RadioGroup>
        <Box>
          {kind === 'value' ? (
            <FormSelect
              name="grade"
              label="Grade"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              options={GRADE_VALUES.map((v) => ({ value: String(v), label: gradeValueLabel(v) }))}
              placeholder="Choose a grade"
            />
          ) : (
            <>
              <FormSelect
                name="mark"
                label="Mark"
                required
                value={mark}
                onChange={(e) => setMark(e.target.value)}
                options={marks.map((m) => ({ value: m.value, label: m.label }))}
                placeholder="Choose a mark"
              />
              {picked && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  {picked.help}
                </Typography>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || !ready}>
          {saving ? 'Saving…' : 'Save grade'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
