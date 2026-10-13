import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Paper, Skeleton, Typography } from '@mui/material'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import api from '../api/axios'
import BackHeader from '../components/BackHeader'
import { FormSelect } from '../components/FormControls'
import { useApiList } from '../hooks/useApiList'
import { useCourseOptions } from '../hooks/useCourseOptions'
import { SECTIONS, YEAR_LEVELS, fullName } from '../utils/students'

const EMPTY = { studentId: '', course: '', yearLevel: '', section: '' }

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
  const courseOptions = useCourseOptions().options // the course catalog from the database
  const { rows: pending, loading, error, reload } = useApiList('/students', { status: 'Pending' })

  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  // Give the student classes right away, so their portal is not empty. Both default on.
  const [starter, setStarter] = useState(true)
  const [history, setHistory] = useState(true)

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
      let message = `${fullName(data)} is now enrolled in ${data.course} ${data.yearLevel}, Section ${data.section}.`
      let severity = 'success'
      if (starter) {
        try {
          const { data: records } = await api.post(`/students/${form.studentId}/sample-records`, { history })
          message += ` ${records.message}`
        } catch (err) {
          // The enrollment itself worked; only the classes are missing, and can be added from the student's profile.
          severity = 'warning'
          message += ` Their classes could not be added automatically (${err.response?.data?.message || 'server error'}). Use "Generate sample records" on their profile.`
        }
      }
      navigate('/enrollment', { state: { toast: { severity, message } } })
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
            <FormSelect label="Course" required options={courseOptions} {...bind('course')} />
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
              <FormSelect label="Year Level" required options={YEAR_OPTIONS} {...bind('yearLevel')} />
              <FormSelect label="Section" required options={SECTION_OPTIONS} {...bind('section')} />
            </Box>
          </Box>

          <Box sx={{ mt: 2.5, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#f5f6fa' }}>
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0 }}
              control={<Checkbox size="small" checked={starter} onChange={(e) => setStarter(e.target.checked)} sx={{ pt: 0.5 }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Set up their classes now
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Enrolls the student in this term&apos;s standard subjects for their course and year, so their portal shows a schedule right away.
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0, mt: 1, pl: 3.5 }}
              disabled={!starter}
              control={<Checkbox size="small" checked={history} onChange={(e) => setHistory(e.target.checked)} sx={{ pt: 0.5 }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Also add earlier semesters with sample grades
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Generated demo data for years above 1st year, marked on the profile and removable. Leave off for real records.
                  </Typography>
                </Box>
              }
            />
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
