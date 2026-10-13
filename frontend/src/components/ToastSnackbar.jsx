import { Alert, Snackbar } from '@mui/material'

export default function ToastSnackbar({ toast, onClose }) {
  return (
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {toast ? (
        <Alert severity={toast.severity} variant="filled" onClose={onClose}>
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  )
}
