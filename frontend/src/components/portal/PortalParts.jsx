import Alert from '../ui/Alert'
import Button from '../ui/Button'

// Small building blocks shared by every student-portal screen (Tailwind only).

export function PageTitle({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-700">Student Portal</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ title, subtitle, action, children, className = '', accent = false }) {
  return (
    <section className={`rounded-md border border-navy-100 bg-white shadow-sm ${accent ? 'border-t-[3px] border-t-gold-500' : ''} ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold text-navy-900">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'navy', children }) {
  const colors = { navy: 'text-navy-900', red: 'text-red-700', green: 'text-green-700', amber: 'text-amber-700' }
  return (
    <div className="rounded-md border border-navy-100 border-t-[3px] border-t-gold-500 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-semibold leading-tight ${colors[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {children}
    </div>
  )
}

const PILL_TONES = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-900',
  blue: 'bg-blue-100 text-blue-800',
  grey: 'bg-slate-100 text-slate-700',
  gold: 'bg-gold-100 text-gold-700',
}
export function Pill({ tone = 'grey', children }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}>{children}</span>
}

// Which colour a status word gets.
const STATUS_TONE = {
  Passed: 'green', Approved: 'green', Present: 'green', Cleared: 'green', Completed: 'blue',
  Failed: 'red', Rejected: 'red', Active: 'red',
  Incomplete: 'amber', Pending: 'amber', 'In progress': 'blue', Enrolled: 'blue',
  Dropped: 'grey', Withdrawn: 'grey', Cancelled: 'grey',
}
export function StatusPill({ status }) {
  return <Pill tone={STATUS_TONE[status] ?? 'grey'}>{status}</Pill>
}

export function Skeleton({ className = 'h-40' }) {
  return <div className={`animate-pulse rounded-md bg-navy-100/70 ${className}`} aria-hidden="true" />
}

// Loading placeholder, error with retry, or the content. `state` comes from useApiData.
export function DataGate({ state, children, skeleton }) {
  if (state.error) {
    return (
      <Alert tone="error" className="flex flex-wrap items-center justify-between gap-3">
        <span>{state.error}</span>
        <Button variant="outline" className="!px-3 !py-1" onClick={state.reload}>
          Retry
        </Button>
      </Alert>
    )
  }
  if (!state.data) return skeleton ?? <Skeleton />
  return children(state.data)
}

// Wide tables scroll sideways inside this box instead of stretching the page.
export function TableBox({ children, min = 520 }) {
  return (
    <div className="overflow-x-auto rounded-md border border-navy-100">
      <table className="w-full text-sm" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  )
}
