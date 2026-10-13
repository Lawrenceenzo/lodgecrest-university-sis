import { Box, Typography } from '@mui/material'
import { GOLD_TEXT } from '../theme'

// Page title block: small gold label (eyebrow), serif title, muted subtitle, optional right-side action.
export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
      <Box>
        {eyebrow && (
          <Typography
            component="p"
            sx={{ color: GOLD_TEXT, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', mb: 0.5 }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  )
}
