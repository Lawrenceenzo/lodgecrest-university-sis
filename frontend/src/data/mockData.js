// Hardcoded sample data for the static presentation pages (Enrollment, Grades, Attendance).
// These pages are visual mock-ups and are not connected to the API.

export const SEMESTERS = ['1st Semester 2026-2027', '2nd Semester 2026-2027', '1st Semester 2025-2026']

export const GRADES = [
  { code: 'IT101', name: 'Introduction to Computing', units: 3, grade: 1.5 },
  { code: 'IT102', name: 'Programming 1', units: 3, grade: 1.75 },
  { code: 'GE101', name: 'Purposive Communication', units: 3, grade: 1.25 },
  { code: 'MATH101', name: 'College Algebra', units: 3, grade: 1.75 },
  { code: 'NSTP 1', name: 'National Service Training Program 1', units: 3, grade: 1.5 },
]

export const ATTENDANCE_LOG = [
  { date: 'Aug 04, 2026', subject: 'IT101', status: 'Present' },
  { date: 'Aug 06, 2026', subject: 'IT102', status: 'Present' },
  { date: 'Aug 11, 2026', subject: 'GE101', status: 'Absent' },
  { date: 'Aug 13, 2026', subject: 'IT101', status: 'Late' },
  { date: 'Aug 18, 2026', subject: 'MATH101', status: 'Present' },
  { date: 'Aug 20, 2026', subject: 'IT102', status: 'Present' },
]
export const ATTENDANCE_LOG_TOTAL = 30

export const ATTENDANCE_SUMMARY = [
  { label: 'Present', value: 26, color: '#22a559' },
  { label: 'Absent', value: 3, color: '#e04848' },
  { label: 'Late', value: 1, color: '#f0a020' },
  { label: 'Excused', value: 0, color: '#6b8ae6' },
]

// ---- Academic entities (Courses, Subjects, Sections, Teachers) ----
export const DEPARTMENTS = ['College of Computing', 'College of Business', 'College of Engineering', 'College of Arts and Sciences']

export const COURSES_DATA = [
  { id: 1, code: 'BSIT', name: 'BS Information Technology', department: 'College of Computing', years: 4, students: 540 },
  { id: 2, code: 'BSCS', name: 'BS Computer Science', department: 'College of Computing', years: 4, students: 310 },
  { id: 3, code: 'BSA', name: 'BS Accountancy', department: 'College of Business', years: 4, students: 275 },
  { id: 4, code: 'BSBA', name: 'BS Business Administration', department: 'College of Business', years: 4, students: 198 },
  { id: 5, code: 'BSCpE', name: 'BS Computer Engineering', department: 'College of Engineering', years: 5, students: 142 },
  { id: 6, code: 'BSPsy', name: 'BS Psychology', department: 'College of Arts and Sciences', years: 4, students: 58 },
]

export const SUBJECTS_DATA = [
  { id: 1, code: 'IT101', name: 'Introduction to Computing', units: 3, course: 'BSIT', semester: '1st Sem' },
  { id: 2, code: 'IT102', name: 'Programming 1', units: 3, course: 'BSIT', semester: '1st Sem' },
  { id: 3, code: 'GE101', name: 'Purposive Communication', units: 3, course: 'All Courses', semester: '1st Sem' },
  { id: 4, code: 'MATH101', name: 'College Algebra', units: 3, course: 'All Courses', semester: '1st Sem' },
  { id: 5, code: 'NSTP 1', name: 'National Service Training Program 1', units: 3, course: 'All Courses', semester: '1st Sem' },
  { id: 6, code: 'IT201', name: 'Data Structures and Algorithms', units: 3, course: 'BSIT', semester: '2nd Sem' },
  { id: 7, code: 'CS101', name: 'Discrete Mathematics', units: 3, course: 'BSCS', semester: '1st Sem' },
  { id: 8, code: 'ACC101', name: 'Fundamentals of Accounting', units: 3, course: 'BSA', semester: '1st Sem' },
]

export const SECTIONS_DATA = [
  { id: 1, name: 'BSIT-2A', course: 'BSIT', yearLevel: '2nd Year', section: 'A', adviser: 'Prof. Ramon Dela Cruz', students: 38 },
  { id: 2, name: 'BSCS-1B', course: 'BSCS', yearLevel: '1st Year', section: 'B', adviser: 'Prof. Liza Navarro', students: 40 },
  { id: 3, name: 'BSA-3C', course: 'BSA', yearLevel: '3rd Year', section: 'C', adviser: 'Prof. Eduardo Mercado', students: 35 },
  { id: 4, name: 'BSIT-1B', course: 'BSIT', yearLevel: '1st Year', section: 'B', adviser: 'Prof. Maricel Bautista', students: 42 },
  { id: 5, name: 'BSIT-4B', course: 'BSIT', yearLevel: '4th Year', section: 'B', adviser: 'Prof. Antonio Villareal', students: 31 },
  { id: 6, name: 'BSBA-2A', course: 'BSBA', yearLevel: '2nd Year', section: 'A', adviser: 'Prof. Cynthia Ocampo', students: 37 },
]

export const TEACHERS_DATA = [
  { id: 1, employeeId: 'EMP-0001', name: 'Ramon Dela Cruz', department: 'College of Computing', email: 'ramon.delacruz@lodgecrest.edu', status: 'Active' },
  { id: 2, employeeId: 'EMP-0002', name: 'Liza Navarro', department: 'College of Computing', email: 'liza.navarro@lodgecrest.edu', status: 'Active' },
  { id: 3, employeeId: 'EMP-0003', name: 'Eduardo Mercado', department: 'College of Business', email: 'eduardo.mercado@lodgecrest.edu', status: 'Active' },
  { id: 4, employeeId: 'EMP-0004', name: 'Maricel Bautista', department: 'College of Computing', email: 'maricel.bautista@lodgecrest.edu', status: 'Active' },
  { id: 5, employeeId: 'EMP-0005', name: 'Antonio Villareal', department: 'College of Engineering', email: 'antonio.villareal@lodgecrest.edu', status: 'Inactive' },
  { id: 6, employeeId: 'EMP-0006', name: 'Cynthia Ocampo', department: 'College of Business', email: 'cynthia.ocampo@lodgecrest.edu', status: 'Active' },
]

// ---- Reports ----
export const ATTENDANCE_TREND = [
  { month: 'Aug', rate: 92 },
  { month: 'Sep', rate: 90 },
  { month: 'Oct', rate: 88 },
  { month: 'Nov', rate: 86 },
  { month: 'Dec', rate: 91 },
]

export const RECENT_REPORTS = [
  { id: 1, name: 'Enrollment Summary', generated: 'Oct 10, 2026', format: 'PDF' },
  { id: 2, name: 'Class Attendance Report', generated: 'Oct 08, 2026', format: 'XLSX' },
  { id: 3, name: 'Grade Summary', generated: 'Oct 05, 2026', format: 'PDF' },
  { id: 4, name: 'Student Masterlist', generated: 'Oct 01, 2026', format: 'CSV' },
]
