import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  LinearProgress,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined'
import PageHeader from '../components/PageHeader'
import TablePager from '../components/TablePager'
import ToastSnackbar from '../components/ToastSnackbar'
import AddUserDialog from '../components/users/AddUserDialog'
import { SearchField } from '../components/FilterControls'
import StatusChip from '../components/students/StatusChip'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../components/tableStyles'
import { useApiList } from '../hooks/useApiList'
import { pageWindow } from '../utils/paginate'
import { formatDate } from '../utils/students'

const PAGE_SIZE = 5
const COLUMNS = ['Name', 'Email', 'Role', 'Status', 'Date Added']

export default function Users() {
  const { rows, error, loading, firstLoad, reload } = useApiList('/users')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const term = search.trim().toLowerCase()
  const filtered = term ? rows.filter((u) => `${u.name} ${u.email} ${u.roleLabel}`.toLowerCase().includes(term)) : rows
  const { start, end } = pageWindow(filtered.length, page, PAGE_SIZE)
  const visible = filtered.slice(start, end)

  const handleCreated = (user) => {
    setDialogOpen(false)
    setToast({ severity: 'success', message: `${user.name} was registered. They can now sign in.` })
    reload()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        subtitle="Administrator accounts that can sign in to the system."
        action={
          <Button variant="contained" color="secondary" startIcon={<PersonAddAltOutlined />} onClick={() => setDialogOpen(true)}>
            Add User
          </Button>
        }
      />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Search by name or email…"
          />
        </Box>

        <Box sx={{ height: 3 }}>{loading && !firstLoad && <LinearProgress sx={{ height: 3 }} />}</Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mx: 2, mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={reload}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        <TableContainer>
          <Table sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell key={c} sx={headCellSx}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {firstLoad &&
                Array.from({ length: 3 }, (_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c}>
                        <Skeleton width={c === 'Email' ? 160 : 80} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!firstLoad && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                      {error ? 'Users could not be loaded.' : 'No users match your search.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {visible.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>{u.name[0]}</Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.roleLabel}</TableCell>
                  <TableCell>
                    <StatusChip status="Active" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePager total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Paper>

      {dialogOpen && <AddUserDialog open onClose={() => setDialogOpen(false)} onCreated={handleCreated} />}
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
