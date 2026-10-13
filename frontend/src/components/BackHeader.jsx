import { Link as RouterLink } from 'react-router-dom'
import { Box, IconButton, Link, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

// Page title with a back arrow, a "Back to ..." link beneath, and an optional right-side action.
export default function BackHeader({ title, to = '/students', label = 'Back to Student List', action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={RouterLink} to={to} aria-label={label} size="small" edge="start">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          {title}
        </Typography>
        <Link component={RouterLink} to={to} underline="hover" variant="body2" sx={{ color: 'text.secondary', ml: 4.5 }}>
          ‹ {label}
        </Link>
      </Box>
      {action}
    </Box>
  )
}
