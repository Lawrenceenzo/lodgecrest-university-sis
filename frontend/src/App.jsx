import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import theme from './theme'
import { AuthProvider } from './context/AuthContext'
import { HomeRedirect, ProtectedRoute, PublicRoute, RequireRole } from './routes/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import StudentLayout from './layouts/StudentLayout'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import AddStudent from './pages/AddStudent'
import StudentProfile from './pages/StudentProfile'
import EditStudent from './pages/EditStudent'
import Enrollment from './pages/Enrollment'
import PreEnrollments from './pages/PreEnrollments'
import PaymentSubmissions from './pages/PaymentSubmissions'
import NewEnrollment from './pages/NewEnrollment'
import Grades from './pages/Grades'
import Attendance from './pages/Attendance'
import Users from './pages/Users'
import Courses from './pages/Courses'
import Subjects from './pages/Subjects'
import Sections from './pages/Sections'
import Teachers from './pages/Teachers'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import PortalHome from './pages/portal/PortalHome'
import PortalSchedule from './pages/portal/PortalSchedule'
import PortalGrades from './pages/portal/PortalGrades'
import PortalAccounts from './pages/portal/PortalAccounts'
import PortalPreEnrollment from './pages/portal/PortalPreEnrollment'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Everything below needs a signed-in user */}
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />

              {/* Admin console: data tables, CRUD and editing */}
              <Route element={<RequireRole roles={['admin']} />}>
                <Route element={<AdminLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/enrollment" element={<Enrollment />} />
                  <Route path="/enrollment/new" element={<NewEnrollment />} />
                  <Route path="/pre-enrollments" element={<PreEnrollments />} />
                  <Route path="/payments" element={<PaymentSubmissions />} />
                  <Route path="/grades" element={<Grades />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/subjects" element={<Subjects />} />
                  <Route path="/sections" element={<Sections />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/students/new" element={<AddStudent />} />
                  <Route path="/students/:id" element={<StudentProfile />} />
                  <Route path="/students/:id/edit" element={<EditStudent />} />
                </Route>
              </Route>

              {/* Student portal: locked-down and read-only */}
              <Route element={<RequireRole roles={['student']} />}>
                <Route path="/portal" element={<StudentLayout />}>
                  <Route index element={<PortalHome />} />
                  <Route path="schedule" element={<PortalSchedule />} />
                  <Route path="grades" element={<PortalGrades />} />
                  <Route path="accounts" element={<PortalAccounts />} />
                  <Route path="pre-enrollment" element={<PortalPreEnrollment />} />
                </Route>
              </Route>
            </Route>

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
