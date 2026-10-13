import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Box, Drawer, Toolbar } from '@mui/material'
import Header from './Header'
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar'

const paperSx = { width: SIDEBAR_WIDTH, border: 0, boxSizing: 'border-box' }

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header onMenuClick={() => setMobileOpen(true)} />

      <Box component="aside" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
        {/* Mobile: slide-out drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{ root: { keepMounted: true } }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx }}
        >
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </Drawer>
        {/* Desktop: persistent */}
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': paperSx }}
        >
          <Sidebar />
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
