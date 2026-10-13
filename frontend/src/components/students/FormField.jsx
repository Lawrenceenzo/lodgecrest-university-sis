import { Box, FormHelperText, FormLabel } from '@mui/material'

// Label-above-input wrapper used across the student form (matches the mockup).
export default function FormField({ id, label, required, error, sx, children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0, ...sx }}>
      <FormLabel htmlFor={id} error={Boolean(error)} sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
        {label}
        {required && (
          <Box component="span" sx={{ color: 'error.main', ml: 0.5 }} aria-hidden="true">
            *
          </Box>
        )}
      </FormLabel>
      {children}
      {error && <FormHelperText error sx={{ m: 0 }}>{error}</FormHelperText>}
    </Box>
  )
}
