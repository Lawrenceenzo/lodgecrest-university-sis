// Academic status lifecycle (mirrors backend/models/Student.js).
export const ACADEMIC_STATUSES = [
  { value: 'Enrolled', label: 'Enrolled', help: 'Active student.' },
  { value: 'LOA', label: 'Leave of absence (LOA)', help: 'Temporarily away. Keeps portal access.' },
  { value: 'Graduated', label: 'Graduated', help: 'Completed the program. Keeps portal access (for transcripts).' },
  { value: 'Transferred', label: 'Transferred', help: 'Moved to another institution. Hidden from lists; portal access ends.' },
  { value: 'Archived', label: 'Archived', help: 'Soft delete. Hidden from lists; portal access ends. Can be restored.' },
]

// Hidden from admin lists unless "Show archived & transferred" is on; no portal access.
export const INACTIVE_STATUSES = ['Archived', 'Transferred']

export const isInactive = (student) => INACTIVE_STATUSES.includes(student?.academicStatus)
export const isArchived = (student) => student?.academicStatus === 'Archived'
