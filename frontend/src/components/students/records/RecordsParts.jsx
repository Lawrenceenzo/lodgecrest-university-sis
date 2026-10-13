import { Alert, Box, Button, Skeleton, Typography } from '@mui/material'

// Loading / error wrapper for a tab's data: skeleton on first load, retry on failure, then the content.
export function DataState({ state, children }) {
  if (state.error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={state.reload}>Retry</Button>}>
        {state.error}
      </Alert>
    )
  }
  if (!state.data) return <Skeleton variant="rounded" height={220} />
  return children(state.data)
}

// Section title with an optional action on the right.
export function SectionHeader({ title, subtitle, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  )
}

// Small figure card: a label above a big value.
export function StatTile({ label, value, hint, tone }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: 18, sm: 24 }, fontWeight: 700, lineHeight: 1.4, color: tone ?? 'primary.main', whiteSpace: 'nowrap' }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}

export function EmptyNote({ children }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1.5 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  )
}
