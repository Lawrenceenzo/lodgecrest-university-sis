import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import Logo from '../components/Logo'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'
import { BRAND } from '../config/brand'
import { assetUrl } from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useApiData } from '../hooks/useApiData'

const NAV = [
  { to: '/portal', label: 'Dashboard', end: true },
  { to: '/portal/schedule', label: 'My Schedule' },
  { to: '/portal/grades', label: 'Grades & Transcript' },
  { to: '/portal/accounts', label: 'Clearance & Accounts' },
  { to: '/portal/pre-enrollment', label: 'Pre-Enrollment' },
]

const linkClass = ({ isActive }) =>
  `whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-white/10 text-white shadow-[inset_0_-3px_0_var(--color-gold-500)]' : 'text-white/80 hover:bg-white/5 hover:text-white'
  }`

// Shell for the student portal: a locked-down, read-only area. Built in Tailwind on purpose;
// the admin console is the MUI one (AdminLayout).
export default function StudentLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const me = useApiData('/portal/me').data
  const displayName = me?.name ?? user?.name

  return (
    <div className="flex min-h-screen flex-col bg-navy-50">
      <header className="border-b-[3px] border-gold-500 bg-gradient-to-r from-navy-950 to-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo size={34} />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Student portal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight xl:block">
              <div className="text-sm font-semibold">{displayName}</div>
              <div className="text-xs text-white/70">{me ? `${me.studentId} · ${me.course}` : user?.roleLabel}</div>
            </div>
            {me?.profilePicture ? (
              <img src={assetUrl(me.profilePicture)} alt="" className="hidden size-9 rounded-full border-2 border-gold-500 object-cover sm:block" />
            ) : (
              <div className="hidden size-9 place-items-center rounded-full border-2 border-gold-500 bg-gold-500 text-sm font-bold text-navy-950 sm:grid" aria-hidden="true">
                {displayName?.[0] ?? 'S'}
              </div>
            )}
            <Button variant="light" onClick={() => setConfirmingLogout(true)} className="!px-3 !py-1.5">
              Sign out
            </Button>
            <button
              type="button"
              className="grid size-10 place-items-center rounded hover:bg-white/10 lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-white/10 px-4 pb-3 pt-2 lg:hidden" aria-label="Student portal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} onClick={() => setMenuOpen(false)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <ConfirmModal
        open={confirmingLogout}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={() => {
          setConfirmingLogout(false)
          logout()
        }}
      />

      <footer className="border-t border-navy-100 bg-white py-4 text-center text-xs text-muted">
        {BRAND.name} &middot; Student Portal &middot; Your records are read-only here. Contact the Registrar to change them.
      </footer>
    </div>
  )
}
