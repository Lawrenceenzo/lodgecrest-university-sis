import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
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
import AddIcon from '@mui/icons-material/Add'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import api from '../api/axios'
import PageHeader from '../components/PageHeader'
import IconAction from '../components/IconAction'
import ConfirmDialog from '../components/ConfirmDialog'
import TablePager from '../components/TablePager'
import ToastSnackbar from '../components/ToastSnackbar'
import StatusChip from '../components/students/StatusChip'
import { StaticSelect } from '../components/StaticControls'
import { FilterSelect, SearchField } from '../components/FilterControls'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../components/tableStyles'
import { useApiList } from '../hooks/useApiList'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useRouteToast } from '../hooks/useRouteToast'
import { SEMESTERS } from '../data/mockData'
import { pageWindow } from '../utils/paginate'
import { useCourseOptions } from '../hooks/useCourseOptions'
import { SECTIONS, YEAR_LEVELS, enrollmentId, fullName } from '../utils/students'

const PAGE_SIZE = 5
const COLUMNS = ['Enrollment ID', 'Student ID', 'Name', 'Course', 'Year Level', 'Section', 'Semester', 'Status', 'Actions']

export default function Enrollment() {
  const navigate = useNavigate()
  const courseCodes = useCourseOptions().codes
  const [search, setSearch] = useState('')
  const [course, setCourse] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [section, setSection] = useState('')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useRouteToast()
  const [toRemove, setToRemove] = useState(null)
  const [removing, setRemoving] = useState(false)

  // An enrollment record is an enrolled student, so the table is just the Enrolled students.
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const { rows, error, loading, firstLoad, reload } = useApiList('/students', {
    status: 'Enrolled',
    search: debouncedSearch,
    course,
    yearLevel,
    section,
  })

  const { start, end } = pageWindow(rows.length, page, PAGE_SIZE)
  const visible = rows.slice(start, end)

  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  // Removing an enrollment sends the student back to Pending and clears their academic details.
  const confirmRemove = async () => {
    setRemoving(true)
    try {
      await api.put(`/students/${toRemove.id}`, { status: 'Pending', course: '', yearLevel: '', section: '' })
      setToast({ severity: 'success', message: `Enrollment removed. ${fullName(toRemove)} is Pending again.` })
      reload()
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || 'Could not remove the enrollment.' })
    } finally {
      setRemoving(false)
      setToRemove(null)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Registrar"
        title="Enrollment"
        subtitle="Manage student enrollment records."
        action={
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => navigate('/enrollment/new')}>
            New Enrollment
          </Button>
        }
      />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <SearchField value={search} onChange={onFilter(setSearch)} placeholder="Search by student name or ID…" />
          <FilterSelect value={course} onChange={onFilter(setCourse)} label="Courses" options={courseCodes} />
          <FilterSelect value={yearLevel} onChange={onFilter(setYearLevel)} label="Year Levels" options={YEAR_LEVELS} />
          <FilterSelect
            value={section}
            onChange={onFilter(setSection)}
            label="Sections"
            options={SECTIONS}
            optionLabel={(o) => `Section ${o}`}
          />
          <StaticSelect ariaLabel="Semester" minWidth={200} options={SEMESTERS.map((s) => ({ value: s, label: s }))} />
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
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell key={c} sx={headCellSx} align={c === 'Actions' ? 'center' : 'left'}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {firstLoad &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c}>
                        <Skeleton width={c === 'Name' ? 140 : 70} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!firstLoad && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                      {error ? 'Enrollments could not be loaded.' : 'No enrollments found.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {visible.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{enrollmentId(s)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.studentId}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{fullName(s)}</TableCell>
                  <TableCell>{s.course}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.yearLevel}</TableCell>
                  <TableCell>{s.section}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>1st Sem</TableCell>
                  <TableCell>
                    <StatusChip status={s.status} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75 }}>
                      <IconAction label={`View ${fullName(s)}`} color="#1d4ed8" onClick={() => navigate(`/students/${s.id}`)}>
                        <VisibilityOutlined sx={{ fontSize: 17 }} />
                      </IconAction>
                      <IconAction label={`Remove enrollment of ${fullName(s)}`} color="#dc2626" onClick={() => setToRemove(s)}>
                        <DeleteOutlined sx={{ fontSize: 17 }} />
                      </IconAction>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePager total={rows.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Paper>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Remove enrollment?"
        message={toRemove && `${fullName(toRemove)} will go back to Pending and lose their course, year level and section.`}
        confirmLabel="Remove"
        busyLabel="Removing…"
        busy={removing}
        onCancel={() => setToRemove(null)}
        onConfirm={confirmRemove}
      />

      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}

