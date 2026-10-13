import EntityPage from '../components/entity/EntityPage'
import { DEPARTMENTS, withCurrent } from '../utils/catalog'

const columns = [
  { key: 'code', label: 'Course Code', nowrap: true },
  { key: 'name', label: 'Course Name' },
  { key: 'department', label: 'Department' },
  { key: 'years', label: 'Duration', render: (r) => `${r.years} years`, nowrap: true },
  { key: 'totalUnits', label: 'Units', nowrap: true },
  { key: 'students', label: 'Students' },
]

const fields = [
  { name: 'code', label: 'Course Code', required: true, placeholder: 'e.g. BSIT', helper: 'Letters and digits, 2 to 12. It cannot be changed later.' },
  { name: 'name', label: 'Course Name', required: true, placeholder: 'e.g. BS Information Technology' },
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
  { name: 'years', label: 'Duration', type: 'select', required: true, options: [3, 4, 5, 6].map((y) => ({ value: String(y), label: `${y} years` })) },
  { name: 'totalUnits', label: 'Total units to graduate', type: 'number', integer: true, min: 1, max: 400, required: true, placeholder: 'e.g. 150' },
]

export default function Courses() {
  return (
    <EntityPage
      title="Courses"
      subtitle="Degree programs offered by the university."
      addLabel="Add Course"
      noun="Course"
      searchPlaceholder="Search by code, name or department…"
      path="/courses"
      columns={columns}
      fields={(rows) => fields.map((f) => (f.name === 'department' ? { ...f, options: withCurrent(DEPARTMENTS, rows.find((r) => r.department && !DEPARTMENTS.includes(r.department))?.department) } : f))}
      lockedOnEdit={['code']}
      toValues={(r) => ({ code: r.code, name: r.name, department: r.department, years: String(r.years), totalUnits: String(r.totalUnits) })}
      itemName={(r) => r.code}
    />
  )
}
