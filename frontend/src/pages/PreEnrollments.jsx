import { useState } from 'react'
import { Avatar, Box, Button, Chip, Paper, Skeleton, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography, Alert, FormControlLabel } from '@mui/material'
import api, { assetUrl } from '../api/axios'
import PageHeader from '../components/PageHeader'
import { FormSelect } from '../components/FormControls'
import StatusChip from '../components/students/StatusChip'
import ToastSnackbar from '../components/ToastSnackbar'
import ReviewDialog from '../components/preenrollment/ReviewDialog'
import { useApiData } from '../hooks/useApiData'
import { useApiList } from '../hooks/useApiList'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { apiError, formatDay } from '../utils/records'
import { headCellSx, bodyCellsSx, cardSx } from '../components/tableStyles'
import { GOLD, NAVY } from '../theme'

const STATUS_TABS = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'all']

function IssueChip({ request }) {
  if (request.status !== 'Pending') return null
  const { problems, warnings } = request.review
  if (problems.length) return <Chip size="small" color="error" label={`${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}`} />
  if (warnings.some((w) => w.code === 'PREREQUISITE_CONDITIONAL')) return <Chip size="small" color="warning" variant="outlined" label="Conditional prerequisites" />
  return <Chip size="small" color="success" variant="outlined" label="Ready to approve" />
}

// Switch pre-enrollment on or off for a term.
function TermControl({ onChanged }) {
  const terms = useApiList('/terms')
  const [picked, setPicked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const list = terms.rows
  const selected = list.find((t) => t.id === (picked || list.find((x) => x.enrollmentOpen)?.id || list.find((x) => x.isCurrent)?.id)) ?? null
  const options = list.slice(0, 6).map((t) => ({ value: t.id, label: t.name + (t.isCurrent ? ' (current)' : '') }))

  const toggle = async (open) => {
    setBusy(true)
    setError('')
    try {
      await api.patch(`/terms/${selected.id}`, { enrollmentOpen: open })
      terms.reload()
      onChanged(`Pre-enrollment for ${selected.name} is now ${open ? 'open' : 'closed'}.`)
    } catch (err) {
      setError(apiError(err, 'Could not change this term.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 3 }}>
      <Box sx={{ minWidth: { xs: '100%', sm: 280 } }}>
        <FormSelect name="control-term" label="Term" value={selected?.id ?? ''} onChange={(e) => setPicked(e.target.value)} options={options} disabled={terms.firstLoad} />
      </Box>
      <FormControlLabel
        control={<Switch checked={Boolean(selected?.enrollmentOpen)} onChange={(e) => toggle(e.target.checked)} disabled={!selected || busy} slotProps={{ input: { 'aria-label': 'Pre-enrollment open' } }} />}
        label={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Students can pre-enroll for this term
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Turn this off to stop new requests. Requests already sent stay in the queue.
            </Typography>
          </Box>
        }
      />
      {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
    </Paper>
  )
}

export default function PreEnrollments() {
  const [status, setStatus] = useState('Pending')
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const state = useApiData('/pre-enrollments', { status, search: debounced })
  const [reviewing, setReviewing] = useState(null)
  const [toast, setToast] = useState(null)

  const counts = state.data?.counts
  const requests = state.data?.requests ?? []

  const done = (message) => {
    setReviewing(null)
    setToast({ severity: 'success', message })
    state.reload()
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Registrar" title="Pre-Enrollment" subtitle="Review the classes students have chosen for next term. Approving a request enrolls the student in every class on it." />

      <TermControl onChanged={(message) => setToast({ severity: 'success', message })} />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, pr: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tabs
            value={status}
            onChange={(_, v) => setStatus(v)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Request status"
            sx={{ '& .MuiTabs-indicator': { bgcolor: GOLD, height: 3 }, '& .Mui-selected': { color: `${NAVY} !important`, fontWeight: 700 } }}
          >
            {STATUS_TABS.map((s) => (
              <Tab key={s} value={s} label={`${s === 'all' ? 'All' : s}${counts && s !== 'all' ? ` (${counts[s]})` : ''}`} sx={{ textTransform: 'none', fontWeight: 600 }} />
            ))}
          </Tabs>
          <TextField size="small" placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Search student' } }} sx={{ minWidth: { xs: '100%', sm: 240 }, my: 1, ml: { xs: 2, sm: 0 } }} />
        </Box>

        {state.error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={state.reload}>Retry</Button>} sx={{ m: 2 }}>{state.error}</Alert>
        ) : !state.data ? (
          <Skeleton variant="rounded" height={180} sx={{ m: 2 }} />
        ) : requests.length === 0 ? (
          <Box sx={{ py: 7, textAlign: 'center' }}>
            <Typography variant="subtitle1">{status === 'Pending' && !debounced ? 'Nothing is waiting for approval.' : 'No requests match.'}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>New requests from students appear here.</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 760, ...bodyCellsSx }}>
              <TableHead sx={{ '& th': headCellSx }}>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Term</TableCell>
                  <TableCell>Request</TableCell>
                  <TableCell>Sent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={assetUrl(r.student.profilePicture)} sx={{ width: 34, height: 34, fontSize: 14, bgcolor: NAVY }}>
                          {r.student.name[0]}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.student.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {r.student.studentId} · {r.student.course} {r.student.yearLevel}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{r.term.name}</TableCell>
                    <TableCell>
                      {r.items.length} {r.items.length === 1 ? 'subject' : 'subjects'} · {r.totalUnits} units
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(r.submittedAt)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                        <StatusChip status={r.status} />
                        <IssueChip request={r} />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant={r.status === 'Pending' ? 'contained' : 'outlined'} color={r.status === 'Pending' ? 'secondary' : 'primary'} onClick={() => setReviewing(r)}>
                        {r.status === 'Pending' ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {reviewing && <ReviewDialog request={reviewing} onClose={() => setReviewing(null)} onDone={done} />}
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
