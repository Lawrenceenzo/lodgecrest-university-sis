import DashboardOutlined from '@mui/icons-material/DashboardOutlined'
import PeopleOutlined from '@mui/icons-material/PeopleOutlined'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined'
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined'
import ListAltOutlined from '@mui/icons-material/ListAltOutlined'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import SchoolOutlined from '@mui/icons-material/SchoolOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import BarChartOutlined from '@mui/icons-material/BarChartOutlined'
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'

export const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardOutlined },
  { label: 'Students', path: '/students', icon: PeopleOutlined },
  { label: 'Enrollment', path: '/enrollment', icon: AssignmentOutlined },
  { label: 'Pre-Enrollment', path: '/pre-enrollments', icon: HowToRegOutlined, badge: 'pendingPreEnrollments' },
  { label: 'Courses', path: '/courses', icon: MenuBookOutlined },
  { label: 'Subjects', path: '/subjects', icon: ListAltOutlined },
  { label: 'Sections', path: '/sections', icon: GridViewOutlined },
  { label: 'Teachers', path: '/teachers', icon: SchoolOutlined },
  { label: 'Grades', path: '/grades', icon: EditNoteOutlined },
  { label: 'Attendance', path: '/attendance', icon: EventAvailableOutlined },
  { label: 'Reports', path: '/reports', icon: BarChartOutlined },
  { label: 'User Management', path: '/users', icon: ManageAccountsOutlined },
  { label: 'Settings', path: '/settings', icon: SettingsOutlined },
]
