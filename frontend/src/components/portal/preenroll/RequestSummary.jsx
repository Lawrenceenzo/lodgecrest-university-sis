import { useState } from 'react'
import api from '../../../api/axios'
import Alert from '../../ui/Alert'
import Button from '../../ui/Button'
import { formatDay, formatMeetings } from '../../../utils/records'
import { Card, StatusPill, TableBox } from '../PortalParts'
import { td, th } from '../portalStyles'

// One pre-enrollment request: its classes, status, the Registrar's note, and (while pending) a Cancel button.
export default function RequestSummary({ request, onCancelled, compact = false }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cancel = async () => {
    setBusy(true)
    setError('')
    try {
      await api.delete(`/portal/pre-enrollment/${request.id}`)
      onCancelled()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel the request.')
      setBusy(false)
    }
  }

  const table = (
    <TableBox min={560}>
      <thead>
        <tr>
          <th className={th}>Code</th>
          <th className={th}>Subject</th>
          <th className={th}>Section</th>
          <th className={th}>Schedule</th>
          <th className={`${th} text-right`}>Units</th>
        </tr>
      </thead>
      <tbody>
        {request.items.map((i) => (
          <tr key={i.offeringId}>
            <td className={`${td} font-semibold text-navy-900`}>{i.code}</td>
            <td className={td}>{i.title}</td>
            <td className={td}>{i.section}</td>
            <td className={td}>{formatMeetings(i.meetings)}</td>
            <td className={`${td} text-right`}>{i.units}</td>
          </tr>
        ))}
      </tbody>
    </TableBox>
  )

  const heading = (
    <div className="flex flex-wrap items-center gap-3">
      <StatusPill status={request.status} />
      <span className="text-sm text-muted">
        {request.items.length} {request.items.length === 1 ? 'subject' : 'subjects'} · {request.totalUnits} units · sent {formatDay(request.submittedAt)}
        {request.decidedAt && request.status !== 'Pending' && ` · ${request.status.toLowerCase()} ${formatDay(request.decidedAt)}`}
      </span>
    </div>
  )

  const note = request.status === 'Rejected' && request.note && (
    <Alert tone="error" className="mt-3">
      <strong>Reason from the Registrar:</strong> {request.note}
    </Alert>
  )

  if (compact) {
    return (
      <details className="rounded-md border border-navy-100 bg-white px-4 py-3">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-navy-900">{request.term.name}</span>
            {heading}
          </div>
        </summary>
        {note}
        <div className="mt-3">{table}</div>
      </details>
    )
  }

  return (
    <Card title={`Your request for ${request.term.name}`} subtitle="Waiting for the Registrar to approve it" accent>
      {heading}
      <div className="mt-4">{table}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!confirming ? (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Cancel request
          </Button>
        ) : (
          <>
            <span className="text-sm text-navy-900">Cancel this request? You can submit a new one afterwards.</span>
            <Button variant="primary" onClick={cancel} loading={busy}>
              Yes, cancel it
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
          </>
        )}
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </Card>
  )
}
