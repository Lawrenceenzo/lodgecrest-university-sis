import { AppBar, Avatar, Box, IconButton, Toolbar, Typography } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { useAuth } from '../context/AuthContext'
import { GOLD, NAVY, NAVY_DARK } from '../theme'
import NotificationBell from './NotificationBell'
import { SIDEBAR_WIDTH } from './Sidebar'

export default function Header({ onMenuClick }) {
  const { user } = useAuth()

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        ml: { md: `${SIDEBAR_WIDTH}px` },
        width: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
        borderBottom: `3px solid ${GOLD}`,
        // Stand-in for the campus banner photo in the mockup.
        background: `linear-gradient(90deg, ${NAVY_DARK} 0%, ${NAVY} 55%, #3a5ea8 100%)`,
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton
          color="inherit"
          edge="start"
          aria-label="Open navigation"
          onClick={onMenuClick}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1 }} />

        <NotificationBell />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: 1 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: NAVY_DARK, fontWeight: 700 }}>
            {user?.name?.[0] ?? 'A'}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {user?.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {user?.roleLabel}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
