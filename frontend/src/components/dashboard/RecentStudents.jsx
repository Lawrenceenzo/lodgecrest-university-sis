import { Link as RouterLink } from 'react-router-dom'
import { Avatar, Box, Link, Paper, Skeleton, Typography } from '@mui/material'
import { assetUrl } from '../../api/axios'
import { courseName, formatDate, fullName } from '../../utils/students'

const ROW_SX = { display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' } }

export default function RecentStudents({ students, loading, failed = false, limit = 5 }) {
  const recent = [...students]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Recent Students
        </Typography>
        <Link component={RouterLink} to="/students" underline="hover" variant="body2">
          View All
        </Link>
      </Box>

      {loading &&
        Array.from({ length: limit }, (_, i) => (
          <Box key={i} sx={ROW_SX}>
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
            </Box>
          </Box>
        ))}

      {!loading && !failed && recent.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
          No students yet.
        </Typography>
      )}

      {!loading &&
        recent.map((s) => (
          <Box key={s.id} sx={ROW_SX}>
            <Avatar src={assetUrl(s.profilePicture) || undefined} sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
              {s.firstName[0]}
              {s.lastName[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {fullName(s)}
              </Typography>
              <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                {courseName(s.course)}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
              {formatDate(s.createdAt)}
            </Typography>
          </Box>
        ))}
    </Paper>
  )
}
