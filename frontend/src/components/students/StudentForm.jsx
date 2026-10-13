import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import BackHeader from '../BackHeader'
import FormField from './FormField'
import PhotoPicker from './PhotoPicker'
import { usePhoto } from '../../hooks/usePhoto'
import {
  CIVIL_STATUSES,
  EMPTY_FORM,
  GENDERS,
  SUFFIXES,
  todayISO,
  toPayload,
  validateStudentForm,
} from '../../utils/studentForm'

const fieldsGridSx = { display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }
const cardSx = { p: { xs: 2.5, md: 3 }, border: '1px solid', borderColor: 'divider' }

function SectionTitle({ children, sx }) {
  return (
    <Typography
      variant="subtitle1"
      sx={{ fontWeight: 700, pb: 1, mb: 2.5, borderBottom: '2px solid', borderColor: 'primary.main', display: 'inline-block', ...sx }}
    >
      {children}
    </Typography>
  )
}

// Shared by Add and Edit. `onSubmit(payload, { photo, removePhoto })` should save and navigate
// away on success; if it throws, the error is shown above the form.
export default function StudentForm({
  title,
  initialValues = EMPTY_FORM,
  submitLabel = 'Save Student',
  backTo = '/students',
  backLabel = 'Back to Student List',
  initialPhoto = '', // stored path of the student's current photo, if any
  onSubmit,
}) {
  const [form, setForm] = useState(initialValues)
  const photo = usePhoto(initialPhoto)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null) // { message, details[] }

  const errors = validateStudentForm(form) // derived from state every render
  const shownError = (name) => (submitted || touched[name] ? errors[name] : undefined)

  // Props shared by every text/select input.
  const bind = (name) => ({
    id: name,
    name,
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    error: Boolean(shownError(name)),
    size: 'small',
    fullWidth: true,
  })

  const text = (name, label, { required, placeholder, ...rest } = {}) => (
    <FormField id={name} label={label} required={required} error={shownError(name)}>
      <TextField {...bind(name)} placeholder={placeholder ?? `Enter ${label.toLowerCase()}`} {...rest} />
    </FormField>
  )

  const select = (name, label, options, { required, placeholder, noneLabel } = {}) => (
    <FormField id={name} label={label} required={required} error={shownError(name)}>
      <TextField
        {...bind(name)}
        select
        slotProps={{
          select: {
            displayEmpty: true,
            renderValue: (v) =>
              v || (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {placeholder ?? `Select ${label.toLowerCase()}`}
                </Box>
              ),
          },
        }}
      >
        {noneLabel && <MenuItem value="">{noneLabel}</MenuItem>}
        {options.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>
    </FormField>
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.keys(errors).length) {
      // Bring the first invalid field into view.
      document.getElementById(Object.keys(errors)[0])?.focus()
      return
    }

    setSaving(true)
    try {
      await onSubmit(toPayload(form), { photo: photo.file, removePhoto: photo.removePhoto })
    } catch (err) {
      setServerError({
        message: err.response?.data?.message || 'Could not reach the server. Is the backend running?',
        details: err.response?.data?.errors ?? [],
      })
      setSaving(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <BackHeader title={title} to={backTo} label={backLabel} />

      {serverError && (
        <Alert severity="error" onClose={() => setServerError(null)}>
          {serverError.message}
          {serverError.details.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {serverError.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </Box>
          )}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' }, alignItems: 'start' }}>
        {/* Personal information */}
        <Paper elevation={0} sx={cardSx}>
          <SectionTitle>Personal Information</SectionTitle>

          <PhotoPicker photo={photo} disabled={saving} />

          <Box sx={fieldsGridSx}>
            {text('firstName', 'First Name', { required: true })}
            {text('middleName', 'Middle Name')}
            {text('lastName', 'Last Name', { required: true })}
            {select('suffix', 'Suffix', SUFFIXES, { noneLabel: 'None', placeholder: 'None' })}
            <FormField id="dob" label="Date of Birth" required error={shownError('dob')}>
              <TextField {...bind('dob')} type="date" slotProps={{ htmlInput: { max: todayISO(), min: '1900-01-01' } }} />
            </FormField>
            {select('gender', 'Gender', GENDERS, { required: true })}
            {select('civilStatus', 'Civil Status', CIVIL_STATUSES)}
            {text('nationality', 'Nationality')}
            {text('religion', 'Religion')}
          </Box>
        </Paper>

        {/* Contact information */}
        <Paper elevation={0} sx={cardSx}>
          <SectionTitle>Contact Information</SectionTitle>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {text('email', 'Email Address', { required: true, type: 'email', placeholder: 'Enter email address' })}
            {text('contactNumber', 'Contact Number', { required: true, type: 'tel', placeholder: 'Enter contact number' })}
            {text('address', 'Home Address', {
              required: true,
              multiline: true,
              minRows: 3,
              placeholder: 'Enter complete address',
            })}

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Emergency Contact
            </Typography>
            <Box sx={fieldsGridSx}>
              {text('emergencyName', 'Name', { placeholder: 'Enter contact name' })}
              {text('emergencyPhone', 'Phone Number', { type: 'tel', placeholder: 'Enter contact number' })}
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button variant="outlined" component={RouterLink} to={backTo} disabled={saving} sx={{ bgcolor: '#fff' }}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlined />}
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </Box>
    </Box>
  )
}
