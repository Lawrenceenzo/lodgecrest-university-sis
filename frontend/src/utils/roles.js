// Where each role lives. Admins use the management console, students use the read-only portal.
export const ADMIN_HOME = '/dashboard'
export const STUDENT_HOME = '/portal'

export const homeFor = (user) => (user?.role === 'student' ? STUDENT_HOME : ADMIN_HOME)

// May this user be on this path? (Anyone signed in may change their password.)
export function canVisit(user, pathname) {
  if (pathname === '/change-password') return true
  const inPortal = pathname === STUDENT_HOME || pathname.startsWith(`${STUDENT_HOME}/`)
  return user?.role === 'student' ? inPortal : !inPortal
}

// Where to send a user who has just signed in: a forced password change first, then the page they
// originally asked for (if their role may see it), otherwise their own home.
export function destinationFor(user, requestedPath) {
  if (user.mustChangePassword) return '/change-password'
  if (requestedPath && requestedPath !== '/' && requestedPath !== '/login' && canVisit(user, requestedPath)) return requestedPath
  return homeFor(user)
}
