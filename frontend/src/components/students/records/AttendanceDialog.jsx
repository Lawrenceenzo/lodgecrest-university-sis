import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import api from '../../../api/axios'
import { FormInput, FormSelect } from '../../FormControls'
import { useApiData } from '../../../hooks/useApiData'
import { apiError, ATTENDANCE_STATUSES, formatDay, todayISO } from '../../../utils/records'

// Record (or correct) one day of attendance for one class. Sending the same class and date again
// updates the existing record, so editing a row simply re-opens it with its class and date fixed.
export default function AttendanceDialog({ student, term, record, onClose, onSaved }) {
  const editing = Boolean(record)
  const history = useApiData(`/students/${student.id}/enrollments`)
  const [offeringId, setOfferingId] = useState(record?.offeringId ?? '')
  const [date, setDate] = useState(record?.date ?? todayISO())
  const [status, setStatus] = useState(record?.status ?? 'Present')
  const [remarks, setRemarks] = useState(record?.remarks ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const classes = (history.data?.terms.find((t) => t.term.id === term.id)?.enrollments ?? []).filter((e) => e.status !== 'Dropped')
  const options = classes.map((e) => ({ value: e.offering.id, label: `${e.subject.code} · ${e.subject.title} (Sec ${e.offering.section})` }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.put(`/students/${student.id}/attendance`, { offeringId, date, status, remarks })
      onSaved(editing)
    } catch (err) {
      setError(apiError(err, 'Could not save the attendance.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{editing ? 'Edit attendance' : 'Record attendance'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {term.name}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {history.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {history.error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormSelect
            name="class"
            label="Class"
            required
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            options={options}
            placeholder={history.data && options.length === 0 ? 'No classes this term' : 'Choose a class'}
            disabled={editing || !history.data}
          />
          <FormInput
            name="date"
            label="Date"
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={editing}
            helperText={editing ? formatDay(date) : undefined}
          />
          <FormSelect name="status" label="Status" required value={status} onChange={(e) => setStatus(e.target.value)} options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: s }))} />
          <FormInput name="remarks" label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" slotProps={{ htmlInput: { maxLength: 200 } }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || !offeringId || !date}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
