import { Link } from 'react-router-dom'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined'
import { useAuth } from '../../context/AuthContext'
import { useApiData } from '../../hooks/useApiData'
import { Card, DataGate, Pill, Skeleton, Stat } from '../../components/portal/PortalParts'
import { formatGwa, formatTime, FULL_DAY, peso, todayName } from '../../utils/records'

const ALERT_STYLE = {
  error: { icon: ErrorOutlineOutlined, box: 'border-red-200 bg-red-50 text-red-900' },
  warning: { icon: WarningAmberOutlined, box: 'border-amber-200 bg-amber-50 text-amber-900' },
  info: { icon: InfoOutlined, box: 'border-navy-100 bg-navy-50 text-navy-900' },
  success: { icon: CheckCircleOutlined, box: 'border-green-200 bg-green-50 text-green-900' },
}

const LINKS = [
  { to: '/portal/schedule', title: 'My Schedule', text: 'Your week, class by class.' },
  { to: '/portal/grades', title: 'Grades & Transcript', text: 'Grades by semester and an unofficial transcript.' },
  { to: '/portal/accounts', title: 'Clearance & Accounts', text: 'Your balance, payments and holds.' },
  { to: '/portal/pre-enrollment', title: 'Pre-Enrollment', text: 'Choose your subjects for next term.' },
]

function TodayCard() {
  const state = useApiData('/portal/schedule')
  const today = todayName()
  return (
    <Card title="Today's classes" subtitle={FULL_DAY[today]} action={<Link to="/portal/schedule" className="text-sm font-semibold text-navy-900 underline-offset-4 hover:underline">Full week</Link>}>
      <DataGate state={state} skeleton={<Skeleton className="h-24" />}>
        {({ days }) => {
          const classes = days.find((d) => d.day === today)?.classes ?? []
          if (classes.length === 0) return <p className="text-sm text-muted">No classes today.</p>
          return (
            <ul className="divide-y divide-navy-100">
              {classes.map((c) => (
                <li key={`${c.code}-${c.start}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-900">
                      {c.code} <span className="font-normal text-muted">· {c.title}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {c.room || 'Room to be announced'} · {c.professor}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-navy-900">
                    {formatTime(c.start)}-{formatTime(c.end)}
                  </p>
                </li>
              ))}
            </ul>
          )
        }}
      </DataGate>
    </Card>
  )
}

export default function PortalHome() {
  const { user } = useAuth()
  const state = useApiData('/portal/dashboard')
  const firstName = user?.name?.split(' ')[0] ?? 'Student'

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-700">Student Portal</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold text-navy-900">Welcome, {firstName}</h1>
        <DataGate state={{ ...state, error: '' }} skeleton={<p className="mt-2 h-5 w-72 animate-pulse rounded bg-navy-100/70" />}>
          {(d) => (
            <p className="mt-2 text-sm text-muted">
              {d.student.program?.name ?? 'No program yet'} · {d.student.yearLevel}, Section {d.student.section} · {d.student.studentId}
              {d.currentTerm && <> · {d.currentTerm.name}</>}
            </p>
          )}
        </DataGate>
      </div>

      <DataGate state={state} skeleton={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="GWA" value={formatGwa(d.gwa)} hint="1.00 is the best, 3.00 passes" />
              <Stat label="Units earned" value={d.units.earned} hint={d.units.required ? `of ${d.units.required} · ${d.units.remaining} to go` : 'No program linked'}>
                {d.units.required ? (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-label="Units earned" aria-valuenow={d.units.progressPercent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${d.units.progressPercent}%` }} />
                  </div>
                ) : null}
              </Stat>
              <Stat label="Current load" value={`${d.currentLoad.units} units`} hint={`${d.currentLoad.subjects} ${d.currentLoad.subjects === 1 ? 'class' : 'classes'} this term`} />
              <Stat
                label="Balance"
                value={peso(d.balance)}
                tone={d.balance > 0 ? 'red' : 'green'}
                hint={d.balance > 0 ? 'Amount due' : d.balance < 0 ? 'Overpaid' : 'Settled'}
              >
                {d.activeHolds > 0 && (
                  <div className="mt-2">
                    <Pill tone="red">{d.activeHolds} active {d.activeHolds === 1 ? 'hold' : 'holds'}</Pill>
                  </div>
                )}
              </Stat>
            </div>

            {d.currentLoad.subjects === 0 && d.student.academicStatus === 'Enrolled' && (
              <div className="rounded-md border border-gold-500 bg-gold-50 px-5 py-4 text-sm text-navy-900">
                <p className="font-semibold">You have no classes this term yet.</p>
                <p className="mt-1">
                  Your schedule and grades fill in once the Registrar enrolls you. You can also{' '}
                  <Link to="/portal/pre-enrollment" className="font-semibold underline underline-offset-2">choose your subjects in Pre-Enrollment</Link> when it is open, or contact the Registrar.
                </p>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Needs your attention" subtitle={d.alerts.length ? `${d.alerts.length} ${d.alerts.length === 1 ? 'item' : 'items'}` : undefined}>
                {d.alerts.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-green-800">
                    <CheckCircleOutlined fontSize="small" /> You are all caught up. Nothing needs your attention.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.alerts.map((a) => {
                      const { icon: Icon, box } = ALERT_STYLE[a.severity] ?? ALERT_STYLE.info
                      return (
                        <li key={`${a.code}-${a.message}`} className={`flex items-start gap-2.5 rounded border px-3 py-2.5 text-sm ${box}`}>
                          <Icon fontSize="small" className="mt-0.5 shrink-0" />
                          <span>
                            {a.message}
                            {a.code === 'PRE_ENROLLMENT_OPEN' && (
                              <>
                                {' '}
                                <Link to="/portal/pre-enrollment" className="font-semibold underline underline-offset-2">Start now</Link>
                              </>
                            )}
                            {(a.code === 'BALANCE_DUE' || a.code === 'HOLD') && (
                              <>
                                {' '}
                                <Link to="/portal/accounts" className="font-semibold underline underline-offset-2">View account</Link>
                              </>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
              <TodayCard />
            </div>
          </>
        )}
      </DataGate>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex flex-col gap-1 rounded-md border border-navy-100 border-t-[3px] border-t-gold-500 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          >
            <h2 className="font-serif text-lg font-semibold text-navy-900 group-hover:underline">{t.title}</h2>
            <p className="text-sm text-muted">{t.text}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
