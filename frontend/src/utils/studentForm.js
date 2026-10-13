export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV']
export const GENDERS = ['Male', 'Female', 'Other']
export const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Divorced']

export const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  dob: '',
  gender: '',
  civilStatus: '',
  nationality: '',
  religion: '',
  email: '',
  contactNumber: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
}

const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u
const EMAIL_RE = /^\S+@\S+\.\S+$/

const isPhone = (v) => {
  const digits = v.replace(/\D/g, '')
  return /^[+\d][\d\s()-]*$/.test(v) && digits.length >= 7 && digits.length <= 15
}

// YYYY-MM-DD in local time (what <input type="date"> expects for min/max).
export const todayISO = () => new Date().toLocaleDateString('en-CA')

// Returns { field: message } for every invalid field (empty object = valid).
export function validateStudentForm(f) {
  const e = {}
  const v = (k) => f[k].trim()

  if (!v('firstName')) e.firstName = 'First name is required'
  else if (!NAME_RE.test(v('firstName'))) e.firstName = 'Use letters only'

  if (v('middleName') && !NAME_RE.test(v('middleName'))) e.middleName = 'Use letters only'

  if (!v('lastName')) e.lastName = 'Last name is required'
  else if (!NAME_RE.test(v('lastName'))) e.lastName = 'Use letters only'

  if (!f.dob) e.dob = 'Date of birth is required'
  else if (Number.isNaN(Date.parse(f.dob)) || f.dob < '1900-01-01') e.dob = 'Enter a valid date'
  else if (f.dob > todayISO()) e.dob = 'Date of birth cannot be in the future'

  if (!f.gender) e.gender = 'Gender is required'

  if (!v('email')) e.email = 'Email address is required'
  else if (!EMAIL_RE.test(v('email'))) e.email = 'Enter a valid email address'

  if (!v('contactNumber')) e.contactNumber = 'Contact number is required'
  else if (!isPhone(v('contactNumber'))) e.contactNumber = 'Enter a valid phone number'

  if (!v('address')) e.address = 'Home address is required'

  if (v('emergencyPhone') && !isPhone(v('emergencyPhone'))) e.emergencyPhone = 'Enter a valid phone number'

  return e
}

// Form state -> body for POST /api/students.
export function toPayload(f) {
  const t = (k) => f[k].trim()
  return {
    firstName: t('firstName'),
    middleName: t('middleName'),
    lastName: t('lastName'),
    suffix: f.suffix,
    dob: f.dob,
    gender: f.gender,
    civilStatus: f.civilStatus,
    nationality: t('nationality'),
    religion: t('religion'),
    email: t('email'),
    contactNumber: t('contactNumber'),
    address: t('address'),
    emergencyContact: { name: t('emergencyName'), phone: t('emergencyPhone') },
  }
}

// A student record from the API -> form state (inverse of toPayload).
export function fromStudent(s) {
  const out = { ...EMPTY_FORM }
  for (const key of Object.keys(EMPTY_FORM)) {
    if (typeof s[key] === 'string') out[key] = s[key]
  }
  out.emergencyName = s.emergencyContact?.name ?? ''
  out.emergencyPhone = s.emergencyContact?.phone ?? ''
  return out
}

// Multipart body for POST/PUT /api/students: the text fields plus the optional photo file.
// (Multipart can't nest objects, so the emergency contact is sent as two flat fields.)
export function toFormData(payload, photoFile, removePhoto) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'emergencyContact') {
      fd.append('emergencyContactName', value.name)
      fd.append('emergencyContactPhone', value.phone)
    } else {
      fd.append(key, value)
    }
  }
  if (photoFile) fd.append('photo', photoFile)
  else if (removePhoto) fd.append('removePhoto', 'true')
  return fd
}
