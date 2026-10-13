import { Chip } from '@mui/material'

const STATUS_COLORS = {
  Enrolled: { bg: '#dcf5e4', fg: '#1b8a47' },
  Pending: { bg: '#fdebd0', fg: '#c76a05' },
  LOA: { bg: '#e0e8fb', fg: '#3157b8' },
  Graduated: { bg: '#f4ecdb', fg: '#7a5c22' },
  Transferred: { bg: '#e8eaf0', fg: '#4b5368' },
  Archived: { bg: '#d9dce5', fg: '#343b4d' },
  Active: { bg: '#dcf5e4', fg: '#1b8a47' },
  Present: { bg: '#dcf5e4', fg: '#1b8a47' },
  Absent: { bg: '#fde0e0', fg: '#c62828' },
  Late: { bg: '#fdebd0', fg: '#c76a05' },
  Excused: { bg: '#e0e8fb', fg: '#3157b8' },
  Completed: { bg: '#e0e8fb', fg: '#3157b8' },
  Passed: { bg: '#dcf5e4', fg: '#1b8a47' },
  Failed: { bg: '#fde0e0', fg: '#c62828' },
  Incomplete: { bg: '#fdebd0', fg: '#c76a05' },
  Dropped: { bg: '#e8eaf0', fg: '#4b5368' },
  Withdrawn: { bg: '#e8eaf0', fg: '#4b5368' },
  Cleared: { bg: '#e8eaf0', fg: '#4b5368' },
}
const FALLBACK = { bg: '#e8eaf0', fg: '#5b6275' }

export default function StatusChip({ status }) {
  const { bg, fg } = STATUS_COLORS[status] ?? FALLBACK
  return (
    <Chip
      label={status}
      size="small"
      sx={{ bgcolor: bg, color: fg, fontWeight: 600, fontSize: 12, height: 24, borderRadius: 1 }}
    />
  )
}
