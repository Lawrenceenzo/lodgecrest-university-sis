import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Button, Paper, Skeleton, Tab, Tabs } from '@mui/material'
import KeyOutlined from '@mui/icons-material/KeyOutlined'
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import HistoryOutlined from '@mui/icons-material/HistoryOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import api from '../api/axios'
import BackHeader from '../components/BackHeader'
import AcademicStatusDialog from '../components/students/AcademicStatusDialog'
import PermanentDeleteDialog from '../components/students/PermanentDeleteDialog'
import PortalAccountDialog from '../components/students/PortalAccountDialog'
import ToastSnackbar from '../components/ToastSnackbar'
import { useRouteToast } from '../hooks/useRouteToast'
import ProfileHeader, { EditButton } from '../components/students/profile/ProfileHeader'
import PersonalInfoTab from '../components/students/profile/PersonalInfoTab'
import AcademicInfoTab from '../components/students/profile/AcademicInfoTab'
import EnrollmentHistoryTab from '../components/students/profile/EnrollmentHistoryTab'
import GradesTab from '../components/students/profile/GradesTab'
import AttendanceTab from '../components/students/profile/AttendanceTab'
import AccountsTab from '../components/students/profile/AccountsTab'
import { GOLD, NAVY } from '../theme'
import { ACADEMIC_STATUSES, isArchived } from '../utils/lifecycle'
import { fullName } from '../utils/students'

const TABS = [
  { label: 'Personal Information', icon: PersonOutlined },
  { label: 'Academic Information', icon: SchoolOutlined },
  { label: 'Enrollment History', icon: HistoryOutlined },
  { label: 'Grades', icon: EditNoteOutlined },
  { label: 'Attendance', icon: EventAvailableOutlined },
  { label: 'Accounts & Holds', icon: AccountBalanceWalletOutlined },
]

const tabsSx = {
  px: 1,
  borderBottom: '1px solid',
  borderColor: 'divider',
  '& .MuiTabs-indicator': { height: 3, bgcolor: GOLD, borderRadius: '3px 3px 0 0' },
  '& .MuiTab-root': {
    minHeight: 52,
    color: 'text.secondary',
    fontSize: 13.5,
    fontWeight: 600,
    gap: 0.5,
    '&:hover': { color: NAVY },
    '&.Mui-selected': { color: NAVY, fontWeight: 700 },
  },
}

export default function StudentProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [toast, setToast] = useRouteToast()
  const [tab, setTab] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [accountOpen, setAccountOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // A result stamped with a different key than the current one means a fetch is in flight.
  const key = `${id}:${attempt}`
  const [result, setResult] = useState({ key: null, student: null, status: null, error: '' })
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    api
      .get(`/students/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((res) => setResult({ key, student: res.data, status: 200, error: '' }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return
        setResult({
          key,
          student: null,
          status: err.response?.status ?? 0,
          error: err.response?.data?.message || 'Could not load this student. Is the backend running?',
        })
      })
    return () => controller.abort()
  }, [id, key])

  const { student, status, error } = result
  const notFound = !loading && status === 404
  const failed = !loading && !student && !notFound

  const archived = isArchived(student)
  const refresh = () => setAttempt((n) => n + 1)

  const handleStatusChanged = (next) => {
    setStatusOpen(false)
    const label = ACADEMIC_STATUSES.find((x) => x.value === next)?.label ?? next
    setToast({ severity: 'success', message: `${fullName(student)} is now: ${label}.` })
    refresh()
  }

  const restore = async () => {
    setBusy(true)
    try {
      await api.post(`/students/${id}/restore`)
      setToast({ severity: 'success', message: `${fullName(student)} was restored.` })
      refresh()
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Could not restore the student.' })
    } finally {
      setBusy(false)
    }
  }

  const deleteForever = async (typedConfirmation) => {
    setBusy(true)
    setDeleteError('')
    try {
      await api.delete(`/students/${id}`, { params: { permanent: 'true', confirm: typedConfirmation } })
      navigate('/students', { state: { toast: { severity: 'success', message: `${fullName(student)} was permanently deleted.` } } })
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete the student.')
      setBusy(false)
    }
  }

  const handleEdit = () => navigate(`/students/${id}/edit`, { state: { from: `/students/${id}` } })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <BackHeader
        title="Student Profile"
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" startIcon={<KeyOutlined />} onClick={() => setAccountOpen(true)} disabled={!student}>
              Portal Account
            </Button>
            <Button variant="outlined" size="small" startIcon={<SwapHorizOutlined />} onClick={() => setStatusOpen(true)} disabled={!student}>
              Change status
            </Button>
            <EditButton onClick={handleEdit} disabled={!student || archived} />
          </Box>
        }
      />

      {notFound && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/students">
              Back to list
            </Button>
          }
        >
          {error || 'Student not found'}
        </Alert>
      )}

      {failed && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {archived && (
        <Alert
          severity="warning"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={restore} disabled={busy}>
                Restore
              </Button>
              <Button
                color="error"
                size="small"
                onClick={() => {
                  setDeleteError('')
                  setDeleteOpen(true)
                }}
                disabled={busy}
              >
                Delete permanently
              </Button>
            </Box>
          }
        >
          This record is archived. It is hidden from the student lists and the student cannot sign in to the portal.
        </Alert>
      )}

      {!notFound && !failed && (
        <>
          <ProfileHeader student={student} loading={loading} />

          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Student profile sections"
              sx={tabsSx}
            >
              {TABS.map(({ label, icon: Icon }, i) => (
                <Tab
                  key={label}
                  label={label}
                  icon={<Icon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  id={`profile-tab-${i}`}
                  aria-controls="profile-tabpanel"
                />
              ))}
            </Tabs>

            <Box
              role="tabpanel"
              id="profile-tabpanel"
              aria-labelledby={`profile-tab-${tab}`}
              sx={{ p: { xs: 2.5, md: 4 } }}
            >
              {loading || !student ? (
                <Skeleton variant="rounded" height={220} />
              ) : tab === 0 ? (
                <PersonalInfoTab student={student} />
              ) : tab === 1 ? (
                <AcademicInfoTab student={student} />
              ) : tab === 2 ? (
                <EnrollmentHistoryTab student={student} readOnly={archived} notify={setToast} />
              ) : tab === 3 ? (
                <GradesTab student={student} readOnly={archived} notify={setToast} />
              ) : tab === 4 ? (
                <AttendanceTab student={student} readOnly={archived} notify={setToast} />
              ) : (
                <AccountsTab student={student} readOnly={archived} notify={setToast} />
              )}
            </Box>
          </Paper>
        </>
      )}

      {statusOpen && student && <AcademicStatusDialog student={student} onClose={() => setStatusOpen(false)} onChanged={handleStatusChanged} />}
      {deleteOpen && student && (
        <PermanentDeleteDialog student={student} busy={busy} error={deleteError} onCancel={() => setDeleteOpen(false)} onConfirm={deleteForever} />
      )}
      {accountOpen && student && <PortalAccountDialog student={student} onClose={() => setAccountOpen(false)} />}
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
