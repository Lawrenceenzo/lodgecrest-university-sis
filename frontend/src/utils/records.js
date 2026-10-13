// Formatting and constants shared by the academic-record tabs and their dialogs.

// The grading scale (1.00 best, 3.00 passing, 5.00 failed). Mirrors backend/models/Grade.js.
export const GRADE_VALUES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 5]
export const GRADE_MARKS = [
  { value: 'INC', label: 'INC - Incomplete', help: 'Requirements not yet met. Keeps the class on the record, earns no units.' },
  { value: 'DRP', label: 'DRP - Dropped', help: 'Officially dropped. Ends the class and frees the seat.', dropsClass: true },
  { value: 'W', label: 'W - Withdrawn', help: 'Withdrew after the drop period. Ends the class and frees the seat.', dropsClass: true },
]
export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Excused', 'Absent']
export const CHARGE_CATEGORIES = ['Tuition', 'Miscellaneous', 'Laboratory', 'Other']
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'GCash', 'Credit Card', 'Scholarship']
export const HOLD_TYPES = ['Library', 'Accounting', 'Registrar', 'Guidance', 'Other']

export const formatGwa = (gwa) => (gwa === null || gwa === undefined ? '-' : gwa.toFixed(2))
export const gradeValueLabel = (v) => (v === 5 ? '5.00 (Failed)' : v === 3 ? '3.00 (Passing)' : v === 1 ? '1.00 (Excellent)' : v.toFixed(2))
export const gradeText = (grade) => (!grade ? '-' : grade.value !== null ? grade.value.toFixed(2) : grade.mark)

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
export const peso = (n) => pesoFormat.format(n ?? 0)

// "YYYY-MM-DD" -> "Oct 31, 2026" without timezone shifts.
export const formatDay = (iso) => {
  if (!iso) return '-'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const formatTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// [{day, start, end, room}] -> "Mon/Wed 9:00 AM-10:30 AM (Rm 201)". Days sharing a time are joined.
export function formatMeetings(meetings) {
  if (!meetings?.length) return 'No schedule yet'
  const groups = new Map()
  for (const m of meetings) {
    const k = `${m.start}-${m.end}-${m.room || ''}`
    if (!groups.has(k)) groups.set(k, { days: [], m })
    groups.get(k).days.push(m.day)
  }
  return [...groups.values()]
    .map(({ days, m }) => `${days.join('/')} ${formatTime(m.start)}-${formatTime(m.end)}${m.room ? ` (${m.room})` : ''}`)
    .join('; ')
}

export const apiError = (err, fallback) => err.response?.data?.message || fallback

// "08:30" -> 510 (minutes since midnight), for placing classes on a timetable.
export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Days of the week as the API names them, and the one that is today.
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const todayName = () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
export const FULL_DAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
