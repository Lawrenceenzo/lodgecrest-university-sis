import { useState } from 'react'
import api from '../../../api/axios'
import Alert from '../../ui/Alert'
import Button from '../../ui/Button'
import { Card } from '../PortalParts'

// "Your selection": the chosen classes, the unit meter, what the server says about them, and Submit.
export default function SelectionPanel({ picked, onRemove, limits, existingUnits, checkState, onSubmitted }) {
  const { check, checking, failed } = checkState
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const chosenUnits = picked.reduce((n, o) => n + o.subject.units, 0)
  const total = existingUnits + chosenUnits
  const over = total > limits.maxUnits
  const pct = Math.min(100, Math.round((total / limits.maxUnits) * 100))
  const regularAt = Math.round((limits.regularMinUnits / limits.maxUnits) * 100)
  const canSubmit = picked.length > 0 && check?.ok === true && !checking && !busy

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post('/portal/pre-enrollment', { offeringIds: picked.map((o) => o.id) })
      onSubmitted()
    } catch (err) {
      const problems = err.response?.data?.problems
      setError(problems?.length ? problems.map((p) => p.message).join(' ') : err.response?.data?.message || 'Could not submit your request.')
      setConfirming(false)
      setBusy(false)
    }
  }

  return (
    <Card title="Your selection" subtitle={picked.length ? `${picked.length} ${picked.length === 1 ? 'subject' : 'subjects'}` : 'Nothing chosen yet'} accent>
      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-navy-900">{total} units</span>
          <span className="text-xs text-muted">maximum {limits.maxUnits}</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-label="Unit load" aria-valuenow={total} aria-valuemin={0} aria-valuemax={limits.maxUnits}>
          <div className={`h-full rounded-full ${over ? 'bg-red-600' : 'bg-gold-500'}`} style={{ width: `${pct}%` }} />
          <div className="absolute inset-y-0 w-px bg-navy-900/50" style={{ left: `${regularAt}%` }} title={`Regular load: ${limits.regularMinUnits} units`} />
        </div>
        <p className="mt-1 text-xs text-muted">
          The line marks a regular load ({limits.regularMinUnits} units).{existingUnits > 0 && ` Includes ${existingUnits} units you already have this term.`}
        </p>
      </div>

      {picked.length === 0 ? (
        <p className="text-sm text-muted">Add classes from the list. Each one is checked for seats, schedule clashes and prerequisites as you go.</p>
      ) : (
        <ul className="mb-4 divide-y divide-navy-100 rounded border border-navy-100">
          {picked.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-navy-900">{o.subject.code}</span> <span className="text-muted">Sec {o.section} · {o.subject.units}u</span>
              </span>
              <button type="button" className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700" onClick={() => onRemove(o)} aria-label={`Remove ${o.subject.code}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {checking && <p className="mb-3 text-xs text-muted" role="status">Checking your selection…</p>}
      {failed && <Alert tone="error" className="mb-3">Could not check your selection. Try again in a moment.</Alert>}
      {check && check.problems.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5" aria-label="Problems">
          {check.problems.map((p, i) => (
            <li key={`${p.code}-${i}`} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {p.message}
            </li>
          ))}
        </ul>
      )}
      {check && check.warnings.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5" aria-label="Warnings">
          {check.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {w.message}
            </li>
          ))}
        </ul>
      )}
      {check?.ok && picked.length > 0 && check.problems.length === 0 && <p className="mb-3 text-xs font-medium text-green-800">Looks good: no clashes and nothing blocking this request.</p>}

      {error && <Alert tone="error" className="mb-3">{error}</Alert>}

      {!confirming ? (
        <Button variant="gold" className="w-full" disabled={!canSubmit} onClick={() => setConfirming(true)}>
          Review &amp; submit
        </Button>
      ) : (
        <div className="rounded border border-gold-500 bg-gold-50 p-3">
          <p className="text-sm text-navy-900">
            Send {picked.length} {picked.length === 1 ? 'subject' : 'subjects'} ({chosenUnits} units) to the Registrar for approval? You will not be enrolled until it is approved, and you can cancel while it is pending.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={submit} loading={busy}>
              Submit request
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
