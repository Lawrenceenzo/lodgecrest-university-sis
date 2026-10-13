import { useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material'
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import BuildOutlined from '@mui/icons-material/BuildOutlined'
import PersonOutlined from '@mui/icons-material/PersonOutlined'

// Hardcoded sample notifications for the demo; read state lives in component state.
const INITIAL = [
  { id: 1, icon: SchoolOutlined, color: '#16a34a', title: 'Maria Angela Santos just enrolled', detail: 'BSIT - 2nd Year, Section A', time: '5 min ago', read: false },
  { id: 2, icon: EditNoteOutlined, color: '#2563eb', title: 'New grades posted for BSIT', detail: '1st Semester 2026-2027', time: '1 hour ago', read: false },
  { id: 3, icon: BuildOutlined, color: '#d99a06', title: 'System maintenance scheduled', detail: 'Saturday, 11:00 PM - 1:00 AM', time: 'Yesterday', read: false },
  { id: 4, icon: PersonOutlined, color: '#7c4dff', title: 'John Paul Reyes updated their profile', detail: 'Contact number changed', time: '2 days ago', read: true },
]

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null)
  const [items, setItems] = useState(INITIAL)

  const unread = items.filter((n) => !n.read).length
  const open = Boolean(anchorEl)

  const markRead = (id) => setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))

  const markAllRead = () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })))
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <Badge badgeContent={unread} color="error">
          <NotificationsNoneOutlined />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', mt: 1 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {unread ? `${unread} unread` : 'All caught up'}
          </Typography>
        </Box>
        <Divider />

        <List disablePadding sx={{ maxHeight: 340, overflowY: 'auto' }}>
          {items.map(({ id, icon: Icon, color, title, detail, time, read }) => (
            <ListItemButton
              key={id}
              onClick={() => markRead(id)}
              sx={{ alignItems: 'flex-start', gap: 0.5, bgcolor: read ? 'transparent' : '#eef3ff' }}
            >
              <ListItemAvatar sx={{ minWidth: 48 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: `${color}1f`, color }}>
                  <Icon fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={title}
                secondary={`${detail} · ${time}`}
                slotProps={{
                  primary: { sx: { fontSize: 14, fontWeight: read ? 500 : 700 } },
                  secondary: { sx: { fontSize: 12 } },
                }}
              />
              {!read && <Box aria-label="Unread" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', mt: 1.25, flexShrink: 0 }} />}
            </ListItemButton>
          ))}
        </List>

        <Divider />
        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={markAllRead} disabled={unread === 0} sx={{ fontWeight: 700 }}>
            Mark all as read
          </Button>
        </Box>
      </Popover>
    </>
  )
}
