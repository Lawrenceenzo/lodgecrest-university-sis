import { useState } from 'react'
import { Alert, Avatar, Box, Button, Paper, Skeleton, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
import { assetUrl } from '../api/axios'
import PageHeader from '../components/PageHeader'
import ToastSnackbar from '../components/ToastSnackbar'
import ReviewPaymentDialog from '../components/payments/ReviewPaymentDialog'
import StatusChip from '../components/students/StatusChip'
import { bodyCellsSx, cardSx, headCellSx } from '../components/tableStyles'
import { useApiData } from '../hooks/useApiData'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { formatDay, peso } from '../utils/records'
import { GOLD, NAVY } from '../theme'

const STATUS_TABS = ['Pending', 'Approved', 'Rejected', 'all']

export default function PaymentSubmissions() {
  const [status, setStatus] = useState('Pending')
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const state = useApiData('/payment-submissions', { status, search: debounced })
  const [reviewing, setReviewing] = useState(null)
  const [toast, setToast] = useState(null)

  const counts = state.data?.counts
  const submissions = state.data?.submissions ?? []

  const done = (message) => {
    setReviewing(null)
    setToast({ severity: 'success', message })
    state.reload()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Cashier" title="Payment Verification" subtitle="Check the proof of payment students send in. Approving records the payment on their account and lowers their balance." />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, pr: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={status}
            onChange={(_, v) => setStatus(v)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Payment status"
            sx={{ '& .MuiTabs-indicator': { bgcolor: GOLD, height: 3 }, '& .Mui-selected': { color: `${NAVY} !important`, fontWeight: 700 } }}
          >
            {STATUS_TABS.map((s) => (
              <Tab key={s} value={s} label={`${s === 'all' ? 'All' : s}${counts && s !== 'all' ? ` (${counts[s]})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
            ))}
          </Tabs>
          <TextField size="small" placeholder="Search student or reference" value={search} onChange={(e) => setSearch(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Search student or reference' } }} sx={{ minWidth: { xs: '100%', sm: 260 }, my: 1, ml: { xs: 2, sm: 0 } }} />
        </Box>

        {state.error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={state.reload}>Retry</Button>} sx={{ m: 2 }}>{state.error}</Alert>
        ) : !state.data ? (
          <Skeleton variant="rounded" height={180} sx={{ m: 2 }} />
        ) : submissions.length === 0 ? (
          <Box sx={{ py: 7, textAlign: 'center' }}>
            <Typography variant="subtitle1">{status === 'Pending' && !debounced ? 'No payments are waiting for verification.' : 'No payments match.'}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Payments students submit appear here.</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 820, ...bodyCellsSx }}>
              <TableHead sx={{ '& th': headCellSx }}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {submissions.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={assetUrl(p.student.profilePicture)} sx={{ width: 34, height: 34, fontSize: 14, bgcolor: NAVY }}>
                          {p.student.name[0]}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.student.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {p.student.studentId} · {p.student.course} {p.student.yearLevel}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{peso(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{p.referenceNo}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(p.submittedAt)}</TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant={p.status === 'Pending' ? 'contained' : 'outlined'} color={p.status === 'Pending' ? 'secondary' : 'primary'} onClick={() => setReviewing(p)}>
                        {p.status === 'Pending' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {reviewing && <ReviewPaymentDialog submission={reviewing} onClose={() => setReviewing(null)} onDone={done} />}
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
