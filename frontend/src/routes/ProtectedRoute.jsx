import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { destinationFor, homeFor } from '../utils/roles'

function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  )
}

// Wraps every private route. Signed-out visitors go to /login (and come back afterwards);
// an account that still has a temporary password can reach nothing but /change-password.
export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

// Limits a group of routes to some roles. Anyone else is sent to their own home screen
// (an admin typing /portal lands on the dashboard; a student typing /students lands in the portal).
// This is a convenience: the API enforces the same rule on the server.
export function RequireRole({ roles }) {
  const { user } = useAuth()
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Wraps /login: signed-in users go straight to where they belong.
export function PublicRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (user) return <Navigate to={destinationFor(user, location.state?.from?.pathname)} replace />
  return <Outlet />
}

// "/" sends everyone to the right place.
export function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  return <Navigate to={user ? destinationFor(user) : '/login'} replace />
}
