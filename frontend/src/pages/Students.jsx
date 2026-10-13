import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Switch,
  FormControlLabel,
  TextField,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import api from '../api/axios'
import ToastSnackbar from '../components/ToastSnackbar'
import { useRouteToast } from '../hooks/useRouteToast'
import PageHeader from '../components/PageHeader'
import StudentsTable from '../components/students/StudentsTable'
import ConfirmDialog from '../components/ConfirmDialog'
import PermanentDeleteDialog from '../components/students/PermanentDeleteDialog'
import TablePager from '../components/TablePager'
import { useApiList } from '../hooks/useApiList'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { pageWindow } from '../utils/paginate'
import { COURSES, SECTIONS, YEAR_LEVELS, fullName } from '../utils/students'

const PAGE_SIZE = 5

const selectSx = { minWidth: 150, fontSize: 13, bgcolor: '#fff' }

export default function Students() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [section, setSection] = useState('')
  const [page, setPage] = useState(1)
  // Archived and transferred students are hidden unless this is switched on.
  const [showInactive, setShowInactive] = useState(false)

  // Typing is debounced so we don't hit the API on every keystroke.
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const { rows, error, loading, firstLoad, reload } = useApiList('/students', {
    search: debouncedSearch,
    course,
    yearLevel,
    section,
    includeInactive: showInactive ? 'true' : '',
  })

  const [toArchive, setToArchive] = useState(null)
  const [toDeleteForever, setToDeleteForever] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [toast, setToast] = useRouteToast() // may be seeded by another page, e.g. after adding a student

  const changeFilter = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  const { start, end } = pageWindow(rows.length, page, PAGE_SIZE)
  const visible = rows.slice(start, end)

  const handleView = (s) => navigate(`/students/${s.id}`)
  const handleEdit = (s) => navigate(`/students/${s.id}/edit`, { state: { from: '/students' } })
  const handleAdd = () => navigate('/students/new')

  // Runs a request, then reports the outcome in a toast and refreshes the list.
  const act = async (request, successMessage, fallbackError) => {
    setBusy(true)
    try {
      await request()
      setToast({ severity: 'success', message: successMessage })
      reload()
      return true
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || fallbackError })
      return false
    } finally {
      setBusy(false)
    }
  }

  // "Delete" is a soft delete: the student is archived and can be restored.
  const confirmArchive = async () => {
    const s = toArchive
    await act(() => api.delete(`/students/${s.id}`), `${fullName(s)} was archived.`, 'Could not archive the student.')
    setToArchive(null)
  }

  const restore = (s) => act(() => api.post(`/students/${s.id}/restore`), `${fullName(s)} was restored.`, 'Could not restore the student.')

  const deleteForever = async (typedConfirmation) => {
    const s = toDeleteForever
    setDeleteError('')
    setBusy(true)
    try {
      await api.delete(`/students/${s.id}`, { params: { permanent: 'true', confirm: typedConfirmation } })
      setToast({ severity: 'success', message: `${fullName(s)} was permanently deleted.` })
      setToDeleteForever(null)
      reload()
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Could not delete the student.')
    } finally {
      setBusy(false)
    }
  }

  const filterSelect = (value, setter, label, options) => (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={changeFilter(setter)}
      sx={selectSx}
      inputProps={{ 'aria-label': label }}
    >
      <MenuItem value="">{`All ${label}`}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {label === 'Sections' ? `Section ${o}` : o}
        </MenuItem>
      ))}
    </Select>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Records"
        title="Students"
        subtitle="Manage and view all student records."
        action={
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Student
          </Button>
        }
      />

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            size="small"
            placeholder="Search by ID, name, course…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            sx={{ flex: '1 1 240px', maxWidth: 360, '& .MuiInputBase-root': { fontSize: 13, bgcolor: '#fff' } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Search students' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {filterSelect(course, setCourse, 'Courses', COURSES)}
          {filterSelect(yearLevel, setYearLevel, 'Year Levels', YEAR_LEVELS)}
          {filterSelect(section, setSection, 'Sections', SECTIONS)}
          <FormControlLabel
            sx={{ ml: { md: 'auto' }, mr: 0 }}
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked)
                  setPage(1)
                }}
              />
            }
            label={<Box component="span" sx={{ fontSize: 13 }}>Show archived &amp; transferred</Box>}
          />
        </Box>

        {/* Thin bar while refetching after the first load (keeps rows visible). */}
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

        <StudentsTable
          rows={visible}
          loading={firstLoad}
          emptyMessage={error ? 'Students could not be loaded.' : undefined}
          onView={handleView}
          onEdit={handleEdit}
          onArchive={setToArchive}
          onRestore={restore}
          onDeletePermanently={(st) => {
            setDeleteError('')
            setToDeleteForever(st)
          }}
        />

        <TablePager total={rows.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Paper>

      <ConfirmDialog
        open={Boolean(toArchive)}
        title="Archive student?"
        message={
          toArchive &&
          `${fullName(toArchive)} (${toArchive.studentId}) will be archived. They will disappear from the lists and can no longer sign in to the student portal. Nothing is deleted, and you can restore them at any time.`
        }
        confirmLabel="Archive"
        confirmColor="warning"
        busyLabel="Archiving…"
        busy={busy}
        onCancel={() => setToArchive(null)}
        onConfirm={confirmArchive}
      />

      {toDeleteForever && (
        <PermanentDeleteDialog
          student={toDeleteForever}
          busy={busy}
          error={deleteError}
          onCancel={() => setToDeleteForever(null)}
          onConfirm={deleteForever}
        />
      )}

      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
