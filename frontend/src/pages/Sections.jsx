import EntityPage from '../components/entity/EntityPage'
import { useApiList } from '../hooks/useApiList'
import { useCourseOptions } from '../hooks/useCourseOptions'
import { opt } from '../utils/catalog'
import { SECTIONS, YEAR_LEVELS } from '../utils/students'

const columns = [
  { key: 'name', label: 'Section', nowrap: true },
  { key: 'course', label: 'Course' },
  { key: 'yearLevel', label: 'Year Level', nowrap: true },
  { key: 'adviser', label: 'Adviser' },
  { key: 'students', label: 'Students', render: (r) => `${r.students} / ${r.capacity}`, nowrap: true },
]

export default function Sections() {
  const courses = useCourseOptions()
  const teachers = useApiList('/teachers')
  const advisers = teachers.rows.filter((t) => t.status === 'Active')

  const fields = [
    { name: 'course', label: 'Course', type: 'select', required: true, createOnly: true, options: courses.codes.map(opt) },
    { name: 'yearLevel', label: 'Year Level', type: 'select', required: true, createOnly: true, options: YEAR_LEVELS.map(opt) },
    { name: 'section', label: 'Section', type: 'select', required: true, createOnly: true, options: SECTIONS.map((s) => ({ value: s, label: `Section ${s}` })) },
    { name: 'adviserId', label: 'Adviser', type: 'select', required: true, placeholder: advisers.length ? 'Select an adviser' : 'Add a teacher first', options: advisers.map((t) => ({ value: t.id, label: `${t.name} (${t.employeeId})` })) },
    { name: 'capacity', label: 'Capacity', type: 'number', integer: true, min: 1, max: 100, placeholder: 'Default 40' },
  ]

  return (
    <EntityPage
      title="Sections"
      subtitle="Class sections and their advisers."
      addLabel="Add Section"
      noun="Section"
      searchPlaceholder="Search by section, course or adviser…"
      path="/sections"
      columns={columns}
      fields={fields}
      addDisabled={courses.loading || teachers.firstLoad}
      toPayload={(v) => ({ ...v, capacity: v.capacity === '' ? undefined : Number(v.capacity) })}
      toValues={(r) => ({ adviserId: r.adviserId, capacity: String(r.capacity) })}
      itemName={(r) => r.name}
    />
  )
}
