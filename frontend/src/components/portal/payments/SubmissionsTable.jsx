import { useState } from 'react'
import { formatDay, peso } from '../../../utils/records'
import { Card, Pill, TableBox } from '../PortalParts'
import { td, th } from '../portalStyles'
import ProofViewer from './ProofViewer'

const TONE = { Pending: 'amber', Approved: 'green', Rejected: 'red' }
const LABEL = { Pending: 'Pending verification', Approved: 'Approved', Rejected: 'Rejected' }

// "My payment submissions": what was sent, and where each one stands.
export default function SubmissionsTable({ submissions }) {
  const [viewing, setViewing] = useState(null)
  return (
    <Card title="My payment submissions" subtitle="Payments you sent in. Approved ones appear in your payments above.">
      {submissions.length === 0 ? (
        <p className="text-sm text-muted">You have not submitted a payment yet. Use &ldquo;Submit payment&rdquo; after you pay.</p>
      ) : (
        <TableBox min={640}>
          <thead>
            <tr>
              <th className={th}>Submitted</th>
              <th className={th}>Reference</th>
              <th className={th}>Method</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
              <th className={th}>Proof</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((p) => (
              <tr key={p.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDay(p.submittedAt)}</td>
                <td className={`${td} font-medium text-navy-900`}>{p.referenceNo}</td>
                <td className={td}>{p.method}</td>
                <td className={`${td} whitespace-nowrap text-right font-semibold`}>{peso(p.amount)}</td>
                <td className={td}>
                  <Pill tone={TONE[p.status]}>{LABEL[p.status]}</Pill>
                  {p.status === 'Rejected' && p.reason && <p className="mt-1 max-w-xs text-xs text-red-800">Reason: {p.reason}</p>}
                  {p.decidedAt && p.status !== 'Pending' && <p className="mt-0.5 text-xs text-muted">{formatDay(p.decidedAt)}</p>}
                </td>
                <td className={td}>
                  <button type="button" onClick={() => setViewing(p)} className="rounded text-sm font-semibold text-navy-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableBox>
      )}
      {viewing && <ProofViewer submission={viewing} onClose={() => setViewing(null)} />}
    </Card>
  )
}
