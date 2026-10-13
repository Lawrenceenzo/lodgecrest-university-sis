import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Button, Skeleton } from '@mui/material'
import api from '../api/axios'
import BackHeader from '../components/BackHeader'
import StudentForm from '../components/students/StudentForm'
import { fromStudent, toFormData } from '../utils/studentForm'

export default function EditStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // The page that opened the editor (table or profile) is where we return to.
  const returnTo = location.state?.from || `/students/${id}`
  const backLabel = returnTo === '/students' ? 'Back to Student List' : 'Back to Student Profile'

  const [attempt, setAttempt] = useState(0)
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

  const handleSubmit = async (payload, { photo, removePhoto }) => {
    const { data } = await api.put(`/students/${id}`, toFormData(payload, photo, removePhoto))
    // When the e-mail of a student with a portal login changes, the login e-mail changes with it
    // (and they are signed out), so say so.
    const loginNote = data.portalLoginUpdated ? ` Their portal sign-in e-mail is now ${data.email.toLowerCase()} and they were signed out.` : ''
    navigate(returnTo, {
      state: { toast: { severity: 'success', message: `${data.firstName} ${data.lastName} was updated.${loginNote}` } },
    })
  }

  if (!loading && student?.academicStatus === 'Archived') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <BackHeader title="Edit Student" to={returnTo} label={backLabel} />
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={RouterLink} to={`/students/${id}`}>
              Open profile
            </Button>
          }
        >
          This record is archived and cannot be edited. Restore it first (from the student list or its profile).
        </Alert>
      </Box>
    )
  }

  if (!loading && student) {
    return (
      <StudentForm
        key={student.id}
        title="Edit Student"
        initialValues={fromStudent(student)}
        initialPhoto={student.profilePicture}
        submitLabel="Save Changes"
        backTo={returnTo}
        backLabel={backLabel}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <BackHeader title="Edit Student" to={returnTo} label={backLabel} />
      {loading ? (
        <Skeleton variant="rounded" height={420} />
      ) : status === 404 ? (
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
      ) : (
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
    </Box>
  )
}
