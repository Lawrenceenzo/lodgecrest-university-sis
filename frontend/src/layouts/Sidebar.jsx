import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Badge, Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import ConfirmDialog from '../components/ConfirmDialog'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { useApiData } from '../hooks/useApiData'
import { GOLD, NAVY, NAVY_DARK } from '../theme'
import { navItems } from './navItems'

export const SIDEBAR_WIDTH = 240

const itemSx = {
  mx: 1.5,
  mb: 0.5,
  borderRadius: 1,
  color: 'rgba(255,255,255,0.85)',
  '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 38 },
  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
  '&.active': {
    bgcolor: GOLD,
    color: NAVY_DARK,
    fontWeight: 700,
    '&:hover': { bgcolor: GOLD },
  },
}

export default function Sidebar({ onNavigate }) {
  const { logout } = useAuth()
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  // How many pre-enrollment requests are waiting; re-asked whenever the admin moves to another page.
  const { pathname } = useLocation()
  const waiting = {
    pendingPreEnrollments: useApiData('/pre-enrollments/summary', { at: pathname }).data?.pending ?? 0,
    pendingPayments: useApiData('/payment-submissions/summary', { at: pathname }).data?.pending ?? 0,
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: NAVY,
        background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`,
      }}
    >
      <Box sx={{ px: 2.5, py: 2.5, mb: 1.5, borderBottom: '1px solid rgba(184,144,71,0.35)' }}>
        <Logo size={36} />
      </Box>

      <List component="nav" sx={{ flex: 1, overflowY: 'auto', py: 0 }}>
        {navItems.map(({ label, path, icon: Icon, badge }) => (
          <ListItemButton key={path} component={NavLink} to={path} onClick={onNavigate} sx={itemSx}>
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText slotProps={{ primary: { fontSize: 14, fontWeight: 'inherit' } }} primary={label} />
            {badge && waiting[badge] > 0 && <Badge badgeContent={waiting[badge]} color="secondary" max={99} sx={{ mr: 1.5, '& .MuiBadge-badge': { color: NAVY_DARK, fontWeight: 700, position: 'static', transform: 'none' } }} aria-label={`${waiting[badge]} waiting`} />}
          </ListItemButton>
        ))}
      </List>

      <List sx={{ py: 1.5, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <ListItemButton onClick={() => setConfirmingLogout(true)} sx={itemSx}>
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText slotProps={{ primary: { fontSize: 14 } }} primary="Logout" />
        </ListItemButton>
      </List>
      <ConfirmDialog
        open={confirmingLogout}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        confirmColor="primary"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false)
          logout()
        }}
      />
    </Box>
  )
}
