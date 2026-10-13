import { Box, Typography } from '@mui/material'
import { formatBirthDate } from '../../../utils/students'

const blank = (v) => (v && String(v).trim() ? v : '-')

export function Section({ title, rows }) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(96px, 38%) 1fr', sm: '170px 1fr' },
          columnGap: 2,
          rowGap: 1.5,
        }}
      >
        {rows.map(([label, value]) => (
          <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 500, overflowWrap: 'anywhere' }}>
              {blank(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default function PersonalInfoTab({ student: s }) {
  const personal = [
    ['First Name', s.firstName],
    ['Middle Name', s.middleName],
    ['Last Name', s.lastName],
    ['Suffix', s.suffix],
    ['Date of Birth', formatBirthDate(s.dob)],
    ['Gender', s.gender],
    ['Civil Status', s.civilStatus],
    ['Nationality', s.nationality],
    ['Religion', s.religion],
  ]
  const contact = [
    ['Email Address', s.email],
    ['Contact Number', s.contactNumber],
    ['Home Address', s.address],
  ]
  const emergency = [
    ['Emergency Contact', s.emergencyContact?.name],
    ['Contact Number', s.emergencyContact?.phone],
  ]

  return (
    <Box sx={{ display: 'grid', gap: { xs: 4, md: 6 }, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <Section title="Personal Information" rows={personal} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Section title="Contact Information" rows={contact} />
        <Section title="Emergency Contact" rows={emergency} />
      </Box>
    </Box>
  )
}
