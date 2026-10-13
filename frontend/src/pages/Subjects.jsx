import EntityPage from '../components/entity/EntityPage'
import { COURSES_DATA, SUBJECTS_DATA } from '../data/mockData'

const opt = (v) => ({ value: v, label: v })

const columns = [
  { key: 'code', label: 'Subject Code', nowrap: true },
  { key: 'name', label: 'Subject Name' },
  { key: 'units', label: 'Units' },
  { key: 'course', label: 'Course', nowrap: true },
  { key: 'semester', label: 'Semester', nowrap: true },
]

const fields = [
  { name: 'code', label: 'Subject Code', required: true, placeholder: 'e.g. IT103' },
  { name: 'name', label: 'Subject Name', required: true, placeholder: 'e.g. Web Development' },
  { name: 'units', label: 'Units', type: 'select', required: true, options: [1, 2, 3, 4, 5, 6].map((u) => ({ value: String(u), label: String(u) })) },
  { name: 'course', label: 'Course', type: 'select', required: true, options: ['All Courses', ...COURSES_DATA.map((c) => c.code)].map(opt) },
  { name: 'semester', label: 'Semester', type: 'select', required: true, options: ['1st Sem', '2nd Sem', 'Summer'].map(opt) },
]

export default function Subjects() {
  return (
    <EntityPage
      title="Subjects"
      subtitle="Subjects offered per course and semester."
      addLabel="Add Subject"
      noun="Subject"
      searchPlaceholder="Search by code, name or course…"
      columns={columns}
      fields={fields}
      initialRows={SUBJECTS_DATA}
      makeRow={(v, rows) => ({ ...v, id: rows.length + 1, code: v.code.toUpperCase(), units: Number(v.units) })}
    />
  )
}
