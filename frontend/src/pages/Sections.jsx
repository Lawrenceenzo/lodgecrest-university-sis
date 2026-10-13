import EntityPage from '../components/entity/EntityPage'
import { COURSES_DATA, SECTIONS_DATA } from '../data/mockData'
import { SECTIONS, YEAR_LEVELS } from '../utils/students'

const opt = (v) => ({ value: v, label: v })

const columns = [
  { key: 'name', label: 'Section', nowrap: true },
  { key: 'course', label: 'Course' },
  { key: 'yearLevel', label: 'Year Level', nowrap: true },
  { key: 'adviser', label: 'Adviser' },
  { key: 'students', label: 'Students' },
]

const fields = [
  { name: 'course', label: 'Course', type: 'select', required: true, options: COURSES_DATA.map((c) => c.code).map(opt) },
  { name: 'yearLevel', label: 'Year Level', type: 'select', required: true, options: YEAR_LEVELS.map(opt) },
  { name: 'section', label: 'Section', type: 'select', required: true, options: SECTIONS.map((s) => ({ value: s, label: `Section ${s}` })) },
  { name: 'adviser', label: 'Adviser', required: true, placeholder: 'e.g. Prof. Juan Dela Cruz' },
]

export default function Sections() {
  return (
    <EntityPage
      title="Sections"
      subtitle="Class sections and their advisers."
      addLabel="Add Section"
      noun="Section"
      searchPlaceholder="Search by section, course or adviser…"
      columns={columns}
      fields={fields}
      initialRows={SECTIONS_DATA}
      makeRow={(v, rows) => ({ ...v, id: rows.length + 1, name: `${v.course}-${v.yearLevel[0]}${v.section}`, students: 0 })}
    />
  )
}
