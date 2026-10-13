import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import api from '../../api/axios'
import StatusChip from '../students/StatusChip'
import { headCellSx } from '../tableStyles'
import { apiError, formatDay, formatMeetings } from '../../utils/records'

// Look over one request, then approve (this enrolls the student) or reject (the student reads the reason).
export default function ReviewDialog({ request, onClose, onDone }) {
  const pending = request.status === 'Pending'
  const review = request.review ?? { problems: [], warnings: [] }
  const conditional = review.warnings.filter((w) => w.code === 'PREREQUISITE_CONDITIONAL')
  const otherWarnings = review.warnings.filter((w) => w.code !== 'PREREQUISITE_CONDITIONAL')
  const [accept, setAccept] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const flags = (offeringId) => [...review.problems.filter((p) => p.offeringId === offeringId).map((p) => ({ ...p, tone: 'error' })), ...conditional.filter((w) => w.offeringId === offeringId).map((w) => ({ ...w, tone: 'warning' }))]
  const general = review.problems.filter((p) => !p.offeringId)

  const run = async (fn, message) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      onDone(message)
    } catch (err) {
      const problems = err.response?.data?.problems
      setError(problems?.length ? problems.map((p) => p.message).join(' ') : apiError(err, 'That did not work.'))
      setBusy(false)
    }
  }

  const approve = () => run(() => api.post(`/pre-enrollments/${request.id}/approve`, { allowConditional: accept }), `${request.student.name} is now enrolled in ${request.items.length} ${request.items.length === 1 ? 'class' : 'classes'}.`)
  const reject = () => run(() => api.post(`/pre-enrollments/${request.id}/reject`, { note }), `Request from ${request.student.name} was rejected.`)

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {request.student.name}
        <StatusChip status={request.status} />
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {request.student.studentId} · {request.student.course} {request.student.yearLevel}, Section {request.student.section} · {request.term.name} · {request.totalUnits} units · sent {formatDay(request.submittedAt)}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {request.status === 'Rejected' && request.note && <Alert severity="error" sx={{ mb: 2 }}>Reason given: {request.note}</Alert>}
        {pending && general.map((p) => <Alert key={p.code} severity="error" sx={{ mb: 1 }}>{p.message}</Alert>)}
        {pending && otherWarnings.map((w) => <Alert key={`${w.code}-${w.message}`} severity="warning" sx={{ mb: 1 }}>{w.message}</Alert>)}

        <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead sx={{ '& th': headCellSx }}>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Sec</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell align="right">Units</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { fontSize: 13.5, verticalAlign: 'top' } }}>
              {request.items.map((i) => (
                <TableRow key={i.offeringId}>
                  <TableCell sx={{ fontWeight: 600 }}>{i.code}</TableCell>
                  <TableCell>
                    {i.title}
                    {pending && flags(i.offeringId).map((f) => (
                      <Typography key={`${f.code}-${f.message}`} variant="caption" sx={{ display: 'block', color: f.tone === 'error' ? 'error.main' : 'warning.dark', fontWeight: 600 }}>
                        {f.message}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell>{i.section}</TableCell>
                  <TableCell>
                    {formatMeetings(i.meetings)}
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>{i.professor}</Typography>
                  </TableCell>
                  <TableCell align="right">{i.units}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {pending && conditional.length > 0 && review.problems.length === 0 && (
          <FormControlLabel
            control={<Checkbox checked={accept} onChange={(e) => setAccept(e.target.checked)} />}
            label={<Typography variant="body2">I accept the conditional prerequisites above: the student is still taking those classes.</Typography>}
          />
        )}

        {pending && rejecting && (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason for the student"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            helperText={`${note.trim().length}/300. The student will read this.`}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        {pending && !rejecting && (
          <>
            <Button color="error" variant="outlined" onClick={() => setRejecting(true)} disabled={busy}>
              Reject…
            </Button>
            <Button variant="contained" color="secondary" onClick={approve} disabled={busy || review.problems.length > 0 || (conditional.length > 0 && !accept)}>
              {busy ? 'Enrolling…' : 'Approve & enroll'}
            </Button>
          </>
        )}
        {pending && rejecting && (
          <>
            <Button onClick={() => setRejecting(false)} disabled={busy}>
              Back
            </Button>
            <Button color="error" variant="contained" onClick={reject} disabled={busy || note.trim().length < 3}>
              {busy ? 'Rejecting…' : 'Reject request'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
