import EntityPage from '../components/entity/EntityPage'
import StatusChip from '../components/students/StatusChip'
import { DEPARTMENTS, TEACHERS_DATA } from '../data/mockData'

const columns = [
  { key: 'employeeId', label: 'Employee ID', nowrap: true },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
]

const fields = [
  { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Juan Dela Cruz' },
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@lodgecrest.edu' },
]

export default function Teachers() {
  return (
    <EntityPage
      title="Teachers"
      subtitle="Faculty members of the university."
      addLabel="Add Teacher"
      noun="Teacher"
      searchPlaceholder="Search by name, department or email…"
      columns={columns}
      fields={fields}
      initialRows={TEACHERS_DATA}
      makeRow={(v, rows) => ({
        ...v,
        id: rows.length + 1,
        employeeId: `EMP-${String(rows.length + 1).padStart(4, '0')}`,
        status: 'Active',
      })}
    />
  )
}
