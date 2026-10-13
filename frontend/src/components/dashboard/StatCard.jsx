import { Box, Paper, Skeleton, Typography } from '@mui/material'
import { GOLD, GOLD_TINT, NAVY } from '../../theme'

// Headline number card. Colours come from the theme, so every card looks the same.
export default function StatCard({ label, value, icon: Icon, loading }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: 'divider',
        borderTop: `3px solid ${GOLD}`,
      }}
    >
      <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: GOLD_TINT, color: NAVY, flexShrink: 0 }}>
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width={80} sx={{ fontSize: 32 }} />
        ) : (
          <Typography variant="h4" component="p" sx={{ color: NAVY, lineHeight: 1.2 }}>
            {value.toLocaleString()}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
