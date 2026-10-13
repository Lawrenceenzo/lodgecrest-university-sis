import EntityPage from '../components/entity/EntityPage'
import { useCourseOptions } from '../hooks/useCourseOptions'
import { opt } from '../utils/catalog'
import { YEAR_LEVELS } from '../utils/students'

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const columns = [
  { key: 'code', label: 'Subject Code', nowrap: true },
  { key: 'title', label: 'Subject Name' },
  { key: 'units', label: 'Units' },
  { key: 'courses', label: 'Course', nowrap: true },
  { key: 'placement', label: 'Year & Semester' },
]

// Rows come with `curriculum` placements; show them in plain words.
function describe(row) {
  const codes = [...new Set(row.curriculum.map((c) => c.course))]
  const places = [...new Set(row.curriculum.map((c) => `${c.yearLevel[0]}${c.yearLevel.slice(1, 3)} yr, ${c.semester.replace(' Semester', ' sem')}`))]
  return { ...row, courses: codes.length === 0 ? '-' : codes.length > 3 ? `${codes.length} courses` : codes.join(', '), placement: places.length === 0 ? '-' : places.length > 2 ? `${places.length} placements` : places.join('; ') }
}

export default function Subjects() {
  const courses = useCourseOptions()

  const fields = [
    { name: 'code', label: 'Subject Code', required: true, placeholder: 'e.g. IT103', helper: 'It cannot be changed later.' },
    { name: 'title', label: 'Subject Name', required: true, placeholder: 'e.g. Web Development' },
    { name: 'units', label: 'Units', type: 'select', required: true, options: [1, 2, 3, 4, 5, 6].map((u) => ({ value: String(u), label: String(u) })) },
    { name: 'course', label: 'Course', type: 'select', required: true, createOnly: true, options: [opt('All Courses'), ...courses.codes.map(opt)] },
    { name: 'yearLevel', label: 'Year Level', type: 'select', required: true, createOnly: true, options: YEAR_LEVELS.map(opt) },
    { name: 'semester', label: 'Semester', type: 'select', required: true, createOnly: true, options: SEMESTERS.map(opt) },
    { name: 'prerequisites', label: 'Prerequisites', placeholder: 'Subject codes, e.g. IT101, IT102 (optional)' },
    { name: 'countsToGwa', label: 'Counts toward GWA', type: 'select', required: true, options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No (e.g. PE, NSTP)' }] },
  ]

  return (
    <EntityPage
      title="Subjects"
      subtitle="Subjects offered per course and semester."
      addLabel="Add Subject"
      noun="Subject"
      searchPlaceholder="Search by code, name or course…"
      path="/subjects"
      columns={columns}
      fields={fields}
      addDisabled={courses.loading}
      lockedOnEdit={['code']}
      decorate={describe}
      toPayload={(v) => ({ ...v, units: Number(v.units), countsToGwa: v.countsToGwa !== 'false' })}
      toValues={(r) => ({ code: r.code, title: r.title, units: String(r.units), prerequisites: r.prerequisites.join(', '), countsToGwa: String(r.countsToGwa) })}
      itemName={(r) => r.code}
    />
  )
}
