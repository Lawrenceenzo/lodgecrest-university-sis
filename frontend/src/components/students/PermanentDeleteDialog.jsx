import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { fullName } from '../../utils/students'

// Irreversible deletion. The admin must type the student number; the server checks it again.
// Mount it only while open, so the typed text always starts empty.
export default function PermanentDeleteDialog({ student, busy, error, onCancel, onConfirm }) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === student.studentId

  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Permanently delete student?</DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          This cannot be undone. <strong>{fullName(student)}</strong> ({student.studentId}), their photo and their portal login will be erased for good.
        </Alert>
        <Typography variant="body2" sx={{ mb: 1 }}>
          To confirm, type the student number <strong>{student.studentId}</strong>:
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={student.studentId}
          slotProps={{ htmlInput: { 'aria-label': 'Type the student number to confirm' } }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button color="error" variant="contained" disabled={!matches || busy} onClick={() => onConfirm(typed.trim())}>
          {busy ? 'Deleting…' : 'Delete permanently'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
