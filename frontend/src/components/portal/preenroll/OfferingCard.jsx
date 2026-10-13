import Button from '../../ui/Button'
import { formatMeetings } from '../../../utils/records'
import { Pill } from '../PortalParts'

// One class in the picker. Unavailable classes explain why, and cannot be added.
export default function OfferingCard({ offering: o, picked, swapsFrom, issues, onToggle }) {
  const blocked = !o.selectable
  const action = picked ? 'Remove' : swapsFrom ? `Swap section ${swapsFrom}` : 'Add'

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border bg-white p-4 sm:flex-row sm:items-start sm:justify-between ${
        picked ? 'border-gold-500 shadow-[inset_4px_0_0_var(--color-gold-500)]' : 'border-navy-100'
      } ${blocked ? 'opacity-75' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900">
          {o.subject.code} <span className="font-normal text-ink">· {o.subject.title}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Section {o.section} · {o.subject.units} units · {formatMeetings(o.meetings)} · {o.professor}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {o.recommended && <Pill tone="green">Recommended</Pill>}
          <Pill tone={o.seatsLeft === 0 ? 'red' : o.seatsLeft <= 5 ? 'amber' : 'grey'}>{o.seatsLeft === 0 ? 'Full' : `${o.seatsLeft} seats left`}</Pill>
          {o.subject.prerequisites.length > 0 && <Pill tone="grey">Needs {o.subject.prerequisites.join(', ')}</Pill>}
          {o.warnings.map((w) => (
            <Pill key={w.code} tone="amber">
              {w.code === 'PREREQUISITE_CONDITIONAL' ? 'Conditional on a class in progress' : 'Heads up'}
            </Pill>
          ))}
        </div>
        {o.problems.map((p) => (
          <p key={p.code} className="mt-1.5 text-xs font-medium text-red-700">
            {p.message}
          </p>
        ))}
        {issues.map((p) => (
          <p key={`${p.code}-${p.message}`} className="mt-1.5 text-xs font-medium text-red-700">
            {p.message}
          </p>
        ))}
      </div>
      <Button variant={picked ? 'outline' : 'primary'} className="shrink-0 !px-4 !py-1.5" disabled={blocked} onClick={onToggle} aria-label={`${action} ${o.subject.code} section ${o.section}`}>
        {blocked ? 'Unavailable' : action}
      </Button>
    </li>
  )
}
