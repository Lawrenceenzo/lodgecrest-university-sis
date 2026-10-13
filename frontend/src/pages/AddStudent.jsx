import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import StudentForm from '../components/students/StudentForm'
import { toFormData } from '../utils/studentForm'

export default function AddStudent() {
  const navigate = useNavigate()

  const handleSubmit = async (payload, { photo, removePhoto }) => {
    // FormData lets the photo file travel with the text fields (axios sets the multipart header).
    const { data } = await api.post('/students', toFormData(payload, photo, removePhoto))
    navigate('/students', {
      state: { toast: { severity: 'success', message: `${data.firstName} ${data.lastName} was added (${data.studentId}).` } },
    })
  }

  return <StudentForm title="Add Student" onSubmit={handleSubmit} />
}
