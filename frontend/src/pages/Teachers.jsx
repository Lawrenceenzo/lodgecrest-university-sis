import EntityPage from '../components/entity/EntityPage'
import StatusChip from '../components/students/StatusChip'
import { DEPARTMENTS, opt, withCurrent } from '../utils/catalog'

const columns = [
  { key: 'employeeId', label: 'Employee ID', nowrap: true },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
]

const fields = [
  { name: 'name', label: 'Full Name', required: true, placeholder: 'e.g. Juan Dela Cruz' },
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENTS.map(opt) },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@lodgecrest.edu' },
  { name: 'contactNumber', label: 'Contact Number', placeholder: 'Optional' },
  { name: 'status', label: 'Status', type: 'select', required: true, editOnly: true, options: ['Active', 'Inactive'].map(opt) },
]

export default function Teachers() {
  return (
    <EntityPage
      title="Teachers"
      subtitle="Faculty members of the university."
      addLabel="Add Teacher"
      noun="Teacher"
      searchPlaceholder="Search by name, department or email…"
      path="/teachers"
      columns={columns}
      fields={(rows) => fields.map((f) => (f.name === 'department' ? { ...f, options: withCurrent(DEPARTMENTS, rows.find((r) => !DEPARTMENTS.includes(r.department))?.department) } : f))}
      toValues={(r) => ({ name: r.name, department: r.department, email: r.email, contactNumber: r.contactNumber, status: r.status })}
      itemName={(r) => r.name}
    />
  )
}
