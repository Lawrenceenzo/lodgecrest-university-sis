import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, TextField, Typography } from '@mui/material'
import api from '../../api/axios'
import StatusChip from '../students/StatusChip'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { apiError, formatDay, peso } from '../../utils/records'

const Row = ({ label, children }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1, py: 0.6, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  </Box>
)

// Look at one submitted payment and its proof image, then approve it (records the payment) or reject it (with a reason).
export default function ReviewPaymentDialog({ submission, onClose, onDone }) {
  const pending = submission.status === 'Pending'
  const proof = useBlobUrl(`/payment-submissions/${submission.id}/proof`)
  const [mode, setMode] = useState('view') // 'view' | 'approve' | 'reject'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const decide = async (decision) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.put(`/payment-submissions/${submission.id}/verify`, decision === 'Approved' ? { decision } : { decision, reason })
      onDone(decision === 'Approved' ? `${peso(submission.amount)} was recorded for ${submission.student.name}. Their balance is now ${peso(data.balance)}.` : `Payment from ${submission.student.name} was rejected.`)
    } catch (err) {
      setError(apiError(err, 'That did not work.'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        Payment from {submission.student.name}
        <StatusChip status={submission.status} />
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#f5f6fa', p: 1, minHeight: 200, display: 'grid', placeItems: 'center' }}>
            {proof.loading && <Skeleton variant="rounded" width="100%" height={260} />}
            {proof.error && <Alert severity="error">{proof.error}</Alert>}
            {proof.url && (
              <Box component="a" href={proof.url} target="_blank" rel="noreferrer" title="Open the full-size image in a new tab">
                <Box component="img" src={proof.url} alt={`Proof of payment, reference ${submission.referenceNo}`} sx={{ maxWidth: '100%', maxHeight: 420, display: 'block', mx: 'auto' }} />
              </Box>
            )}
          </Box>

          <Box>
            <Row label="Amount">{peso(submission.amount)}</Row>
            <Row label="Method">{submission.method}</Row>
            <Row label="Reference">{submission.referenceNo}</Row>
            <Row label="Date paid">{formatDay(submission.paidOn)}</Row>
            <Row label="Submitted">{formatDay(submission.submittedAt)}</Row>
            <Row label="Student">
              {submission.student.studentId} · {submission.student.course} {submission.student.yearLevel}
            </Row>
            {pending && <Row label="Current balance">{peso(submission.balance)}</Row>}
            {submission.note && <Row label="Student's note">{submission.note}</Row>}
            {!pending && <Row label="Decided">{formatDay(submission.decidedAt)}</Row>}
            {submission.status === 'Rejected' && submission.reason && <Row label="Reason">{submission.reason}</Row>}
            {pending && <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>Check that the amount and reference on the image match the details above. Click the image to open it full size.</Typography>}
          </Box>
        </Box>

        {pending && mode === 'approve' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This records a <strong>{peso(submission.amount)}</strong> {submission.method} payment (reference {submission.referenceNo}) on {submission.student.name}&apos;s account and lowers their balance.
          </Alert>
        )}
        {pending && mode === 'reject' && (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason for the student"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText={`${reason.trim().length}/300. The student will read this.`}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        {pending && mode === 'view' && (
          <>
            <Button color="error" variant="outlined" onClick={() => setMode('reject')}>
              Reject…
            </Button>
            <Button variant="contained" color="secondary" onClick={() => setMode('approve')}>
              Approve…
            </Button>
          </>
        )}
        {pending && mode === 'approve' && (
          <>
            <Button onClick={() => setMode('view')} disabled={busy}>
              Back
            </Button>
            <Button variant="contained" color="secondary" onClick={() => decide('Approved')} disabled={busy}>
              {busy ? 'Recording…' : 'Approve & record payment'}
            </Button>
          </>
        )}
        {pending && mode === 'reject' && (
          <>
            <Button onClick={() => setMode('view')} disabled={busy}>
              Back
            </Button>
            <Button color="error" variant="contained" onClick={() => decide('Rejected')} disabled={busy || reason.trim().length < 3}>
              {busy ? 'Rejecting…' : 'Reject payment'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
