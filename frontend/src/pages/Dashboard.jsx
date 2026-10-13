import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, Select, Typography } from '@mui/material'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/dashboard/StatCard'
import PopulationChart from '../components/dashboard/PopulationChart'
import RecentStudents from '../components/dashboard/RecentStudents'

// No endpoints for these yet - dummy values until teachers/courses/sections exist.
const DUMMY_TOTALS = { teachers: 120, courses: 45, sections: 88 }

export default function Dashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')

  // Bumped by "Retry" to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api
      .get('/students', { signal: controller.signal })
      .then((res) => setStudents(res.data))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return
        setError(err.response?.data?.message || 'Could not load students. Is the backend running?')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setLoading(true)
    setError('')
    setAttempt((n) => n + 1)
  }

  const stats = [
    { label: 'Total Students', value: error ? '—' : students.length, icon: PeopleAltOutlined, loading },
    { label: 'Total Teachers', value: DUMMY_TOTALS.teachers, icon: SchoolOutlined },
    { label: 'Total Courses', value: DUMMY_TOTALS.courses, icon: MenuBookOutlined },
    { label: 'Total Sections', value: DUMMY_TOTALS.sections, icon: GridViewOutlined },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle={`Good day, ${user?.name}! Here's an overview of the student information.`}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Academic Year
            </Typography>
            <Select
              size="small"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              sx={{ fontSize: 13, bgcolor: '#fff' }}
              inputProps={{ 'aria-label': 'Academic year' }}
            >
              <MenuItem value="2026-2027">2026 - 2027</MenuItem>
              <MenuItem value="2025-2026">2025 - 2026</MenuItem>
            </Select>
          </Box>
        }
      />

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        <Box sx={{ minWidth: 0 }}>
          <PopulationChart students={students} loading={loading} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <RecentStudents students={students} loading={loading} failed={Boolean(error)} />
        </Box>
      </Box>
    </Box>
  )
}
