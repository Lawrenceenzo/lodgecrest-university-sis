import { Avatar, Box, Button, Paper, Skeleton, Typography } from '@mui/material'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import BadgeOutlined from '@mui/icons-material/BadgeOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import MailOutlined from '@mui/icons-material/MailOutlined'
import PhoneOutlined from '@mui/icons-material/PhoneOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import Logo from '../../Logo'
import { BRAND } from '../../../config/brand'
import { assetUrl } from '../../../api/axios'
import { NAVY, SERIF } from '../../../theme'
import { academicSummary, fullName } from '../../../utils/students'
import StatusChip from '../StatusChip'

function InfoLine({ icon: Icon, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', minWidth: 0 }}>
      <Icon sx={{ fontSize: 18, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: 'inherit', overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  )
}

export default function ProfileHeader({ student, loading }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 2, md: 3 },
        flexWrap: { xs: 'wrap', md: 'nowrap' },
      }}
    >
      <Avatar
        src={assetUrl(student?.profilePicture) || undefined}
        alt={student ? fullName(student) : ''}
        sx={{ width: 104, height: 104, bgcolor: '#e4e8f1', color: '#9aa3b8', flexShrink: 0 }}
      >
        <PersonOutlined sx={{ fontSize: 64 }} />
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {loading || !student ? (
          <>
            <Skeleton width="50%" sx={{ fontSize: 28 }} />
            <Skeleton width="30%" />
            <Skeleton width="40%" />
            <Skeleton width="45%" />
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h5">
                {fullName(student)}
                {student.suffix && ` ${student.suffix}`}
              </Typography>
              <StatusChip status={student.status} />
              {student.academicStatus && student.academicStatus !== 'Enrolled' && <StatusChip status={student.academicStatus} />}
            </Box>
            <InfoLine icon={BadgeOutlined}>Student ID: {student.studentId}</InfoLine>
            <InfoLine icon={SchoolOutlined}>{academicSummary(student)}</InfoLine>
            <InfoLine icon={MailOutlined}>{student.email}</InfoLine>
            <InfoLine icon={PhoneOutlined}>{student.contactNumber}</InfoLine>
            <InfoLine icon={PlaceOutlined}>{student.address}</InfoLine>
          </>
        )}
      </Box>

      {/* Brand block from the mockup; hidden on small screens. */}
      <Box sx={{ display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
        <Logo size={56} color={NAVY} />
        <Typography sx={{ fontFamily: SERIF, fontStyle: 'italic', color: 'text.secondary', fontSize: 14 }}>
          {BRAND.tagline.join(' ')}
        </Typography>
      </Box>
    </Paper>
  )
}

export function EditButton({ onClick, disabled }) {
  return (
    <Button variant="contained" size="small" onClick={onClick} disabled={disabled} sx={{ px: 2.5 }}>
      Edit
    </Button>
  )
}
