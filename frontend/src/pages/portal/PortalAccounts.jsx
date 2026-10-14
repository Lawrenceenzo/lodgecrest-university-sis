import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined'
import { useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import SubmissionsTable from '../../components/portal/payments/SubmissionsTable'
import SubmitPaymentModal from '../../components/portal/payments/SubmitPaymentModal'
import { Card, DataGate, PageTitle, Pill, Skeleton, Stat, StatusPill, TableBox } from '../../components/portal/PortalParts'
import { td, th } from '../../components/portal/portalStyles'
import { formatDay, peso } from '../../utils/records'

export default function PortalAccounts() {
  const state = useApiData('/portal/accounts')
  const payments = useApiData('/portal/payments')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Clearance & Accounts"
        subtitle="Your balance, what you have paid, and any holds on your record."
        action={
          <Button variant="gold" onClick={() => setSubmitting(true)} disabled={!payments.data}>
            Submit payment
          </Button>
        }
      />

      {sent && <Alert tone="success">Payment submitted. The Registrar&apos;s office will check your proof. Its status appears under &ldquo;My payment submissions&rdquo;.</Alert>}

      <DataGate state={state} skeleton={<Skeleton className="h-96" />}>
        {(d) => (
          <>
            {d.clearance.cleared ? (
              <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-5 py-4 text-green-900">
                <CheckCircleOutlined className="mt-0.5" />
                <div>
                  <p className="font-semibold">You are cleared</p>
                  <p className="text-sm">No active holds and nothing owed.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
                <ReportProblemOutlined className="mt-0.5" />
                <div>
                  <p className="font-semibold">Not yet cleared</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {d.clearance.activeHolds > 0 && <li>{d.clearance.activeHolds} active {d.clearance.activeHolds === 1 ? 'hold' : 'holds'} on your record</li>}
                    {d.clearance.balanceDue > 0 && <li>Balance due: {peso(d.clearance.balanceDue)}</li>}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Total charges" value={peso(d.totalCharges)} />
              <Stat label="Total payments" value={peso(d.totalPayments)} />
              <Stat label="Balance" value={peso(d.balance)} tone={d.balance > 0 ? 'red' : 'green'} hint={d.balance > 0 ? 'Amount due' : d.balance < 0 ? 'Overpaid' : 'Settled'} />
            </div>

            <Card title="Holds" subtitle="A hold must be cleared by the office that placed it.">
              {d.holds.length === 0 ? (
                <p className="text-sm text-muted">You have never had a hold on your record.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {d.holds.map((h) => (
                    <li key={`${h.type}-${h.placedAt}`} className={`flex flex-wrap items-start justify-between gap-2 rounded border px-3 py-2.5 text-sm ${h.status === 'Active' ? 'border-red-200 bg-red-50' : 'border-navy-100 bg-navy-50 opacity-80'}`}>
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-900">{h.type} hold</p>
                        <p className="text-muted">{h.reason}</p>
                        <p className="text-xs text-muted">
                          Placed {formatDay(h.placedAt)}
                          {h.clearedAt && ` · cleared ${formatDay(h.clearedAt)}`}
                        </p>
                      </div>
                      <StatusPill status={h.status === 'Active' ? 'Active' : 'Cleared'} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Statement of account" subtitle="Charges">
              <TableBox min={560}>
                <thead>
                  <tr>
                    <th className={th}>Due</th>
                    <th className={th}>Category</th>
                    <th className={th}>Description</th>
                    <th className={th}>Term</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.charges.map((c, i) => (
                    <tr key={`${c.description}-${i}`}>
                      <td className={`${td} whitespace-nowrap`}>{c.dueDate ? formatDay(c.dueDate) : '-'}</td>
                      <td className={td}>{c.category}</td>
                      <td className={td}>{c.description}</td>
                      <td className={td}>{c.term ?? '-'}</td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold`}>{peso(c.amount)}</td>
                    </tr>
                  ))}
                  {d.charges.length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-muted`} colSpan={5}>No charges yet.</td>
                    </tr>
                  )}
                </tbody>
              </TableBox>
            </Card>

            <Card title="Payments">
              <TableBox min={560}>
                <thead>
                  <tr>
                    <th className={th}>Paid</th>
                    <th className={th}>Receipt</th>
                    <th className={th}>Method</th>
                    <th className={th}>Term</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.payments.map((p, i) => (
                    <tr key={`${p.receiptNo}-${i}`}>
                      <td className={`${td} whitespace-nowrap`}>{formatDay(p.paidAt)}</td>
                      <td className={td}>{p.receiptNo || '-'}</td>
                      <td className={td}>{p.method}</td>
                      <td className={td}>{p.term ?? '-'}</td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold`}>{peso(p.amount)}</td>
                    </tr>
                  ))}
                  {d.payments.length === 0 && (
                    <tr>
                      <td className={`${td} text-center text-muted`} colSpan={5}>No payments recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </TableBox>
              <p className="mt-3 text-xs text-muted">
                <Pill tone="gold">Tip</Pill> Keep your official receipts. To pay or dispute a charge, visit the Cashier&apos;s Office; this page is read-only.
              </p>
            </Card>
            <DataGate state={payments} skeleton={<Skeleton className="h-40" />}>
              {(p) => <SubmissionsTable submissions={p.submissions} />}
            </DataGate>
          </>
        )}
      </DataGate>

      {submitting && payments.data && (
        <SubmitPaymentModal
          methods={payments.data.methods}
          balance={state.data?.balance ?? 0}
          onClose={() => setSubmitting(false)}
          onSubmitted={() => {
            setSubmitting(false)
            setSent(true)
            payments.reload()
          }}
        />
      )}
    </div>
  )
}
