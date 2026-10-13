import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Toast state that can be seeded by the previous page via navigate(path, { state: { toast } }).
// The router state is cleared right away so a refresh doesn't replay the message.
export function useRouteToast() {
  const location = useLocation()
  const navigate = useNavigate()
  const [toast, setToast] = useState(() => location.state?.toast ?? null) // { severity, message }

  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  return [toast, setToast]
}
