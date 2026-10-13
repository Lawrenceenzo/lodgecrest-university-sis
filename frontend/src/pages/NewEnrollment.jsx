import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Paper, Skeleton } from '@mui/material'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import api from '../api/axios'
import BackHeader from '../components/BackHeader'
import { FormSelect } from '../components/FormControls'
import { useApiList } from '../hooks/useApiList'
import { COURSES, COURSE_NAMES, SECTIONS, YEAR_LEVELS, fullName } from '../utils/students'

const EMPTY = { studentId: '', course: '', yearLevel: '', section: '' }

const COURSE_OPTIONS = COURSES.map((c) => ({ value: c, label: `${c} - ${COURSE_NAMES[c]}` }))
const YEAR_OPTIONS = YEAR_LEVELS.map((y) => ({ value: y, label: y }))
const SECTION_OPTIONS = SECTIONS.map((s) => ({ value: s, label: `Section ${s}` }))

function validate(f) {
  const e = {}
  if (!f.studentId) e.studentId = 'Select a pending student'
  if (!f.course) e.course = 'Course is required'
  if (!f.yearLevel) e.yearLevel = 'Year level is required'
  if (!f.section) e.section = 'Section is required'
  return e
}

export default function NewEnrollment() {
  const navigate = useNavigate()
  const { rows: pending, loading, error, reload } = useApiList('/students', { status: 'Pending' })

  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const errors = validate(form)
  const shown = (name) => (submitted || touched[name] ? errors[name] : undefined)

  const bind = (name) => ({
    name,
    value: form[name],
    error: shown(name),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  })

  // Choosing a student pre-fills any academic details they already have.
  const onStudentChange = (e) => {
    const s = pending.find((p) => String(p.id) === e.target.value)
    setForm({
      studentId: e.target.value,
      course: s?.course ?? '',
      yearLevel: s?.yearLevel ?? '',
      section: s?.section ?? '',
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError('')
    const keys = Object.keys(errors)
    if (keys.length) {
      document.getElementById(keys[0])?.focus()
      return
    }

    setSaving(true)
    try {
      const { data } = await api.put(`/students/${form.studentId}`, {
        status: 'Enrolled',
        course: form.course,
        yearLevel: form.yearLevel,
        section: form.section,
      })
      navigate('/enrollment', {
        state: { toast: { severity: 'success', message: `${fullName(data)} is now enrolled in ${data.course} ${data.yearLevel}, Section ${data.section}.` } },
      })
    } catch (err) {
      setServerError(err.response?.data?.errors?.join(', ') || err.response?.data?.message || 'Could not reach the server.')
      setSaving(false)
    }
  }

  const studentOptions = pending.map((s) => ({ value: String(s.id), label: `${fullName(s)} (${s.studentId})` }))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <BackHeader title="New Enrollment" to="/enrollment" label="Back to Enrollment" />

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!error && !loading && pending.length === 0 && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" component={RouterLink} to="/students/new">
              Add student
            </Button>
          }
        >
          There are no pending students to enroll. Add a new student first.
        </Alert>
      )}

      {serverError && (
        <Alert severity="error" onClose={() => setServerError('')}>
          {serverError}
        </Alert>
      )}

      {loading && !error && <Skeleton variant="rounded" height={340} sx={{ maxWidth: 640 }} />}

      {!loading && !error && pending.length > 0 && (
        <Paper
          component="form"
          onSubmit={handleSubmit}
          noValidate
          elevation={0}
          sx={{ p: { xs: 2.5, md: 3 }, border: '1px solid', borderColor: 'divider', maxWidth: 640, width: '100%' }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <FormSelect
              label="Student"
              required
              options={studentOptions}
              placeholder="Select a pending student"
              {...bind('studentId')}
              onChange={onStudentChange}
            />
            <FormSelect label="Course" required options={COURSE_OPTIONS} {...bind('course')} />
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
              <FormSelect label="Year Level" required options={YEAR_OPTIONS} {...bind('yearLevel')} />
              <FormSelect label="Section" required options={SECTION_OPTIONS} {...bind('section')} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
            <Button variant="outlined" component={RouterLink} to="/enrollment" disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlined />}
            >
              {saving ? 'Enrolling…' : 'Enroll Student'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  )
}
