export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export const COURSE_NAMES = {
  BSIT: 'BS Information Technology',
  BSCS: 'BS Computer Science',
  BSA: 'BS Accountancy',
}

export const courseName = (code) => COURSE_NAMES[code] ?? code

export const fullName = (s) => `${s.lastName}, ${s.firstName}`

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

export const COURSES = Object.keys(COURSE_NAMES)
export const SECTIONS = ['A', 'B', 'C']

// "YYYY-MM-DD" -> local Date (new Date("YYYY-MM-DD") parses as UTC and can shift the day).
const parseDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatBirthDate = (iso) => {
  if (!iso) return ''
  const dob = parseDay(iso)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age -= 1
  const date = dob.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  return `${date} (${age} years old)`
}

// "BSIT - 2nd Year - Section A", or a fallback for students with no academic info yet.
export const academicSummary = (s) =>
  s.course ? [s.course, s.yearLevel, s.section && `Section ${s.section}`].filter(Boolean).join(' - ') : 'Not yet enrolled'

// Enrollment records are derived from enrolled students (one record per student):
// student 2026-0001 -> ENR-2026-001.
export const enrollmentId = (s) => {
  const [year, seq] = (s.studentId || '').split('-')
  return `ENR-${year}-${String(parseInt(seq, 10) || 0).padStart(3, '0')}`
}
