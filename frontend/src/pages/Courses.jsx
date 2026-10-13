import EntityPage from '../components/entity/EntityPage'
import { COURSES_DATA, DEPARTMENTS } from '../data/mockData'

const opt = (v) => ({ value: v, label: v })

const columns = [
  { key: 'code', label: 'Course Code', nowrap: true },
  { key: 'name', label: 'Course Name' },
  { key: 'department', label: 'Department' },
  { key: 'years', label: 'Duration', render: (r) => `${r.years} years`, nowrap: true },
  { key: 'students', label: 'Students' },
]

const fields = [
  { name: 'code', label: 'Course Code', required: true, placeholder: 'e.g. BSIT' },
  { name: 'name', label: 'Course Name', required: true, placeholder: 'e.g. BS Information Technology' },
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS.map(opt) },
  { name: 'years', label: 'Duration', type: 'select', required: true, options: [4, 5].map((y) => ({ value: String(y), label: `${y} years` })) },
]

export default function Courses() {
  return (
    <EntityPage
      title="Courses"
      subtitle="Degree programs offered by the university."
      addLabel="Add Course"
      noun="Course"
      searchPlaceholder="Search by code, name or department…"
      columns={columns}
      fields={fields}
      initialRows={COURSES_DATA}
      makeRow={(v, rows) => ({ ...v, id: rows.length + 1, code: v.code.toUpperCase(), years: Number(v.years), students: 0 })}
    />
  )
}
