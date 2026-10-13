import { useState } from 'react'
import DownloadOutlined from '@mui/icons-material/DownloadOutlined'
import { useApiData } from '../../hooks/useApiData'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import { Card, DataGate, PageTitle, Pill, Skeleton, Stat, StatusPill, TableBox } from '../../components/portal/PortalParts'
import { td, th } from '../../components/portal/portalStyles'
import { downloadFile } from '../../utils/download'
import { formatDay, formatGwa, gradeText } from '../../utils/records'

function TranscriptButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadFile('/portal/transcript.pdf', 'UNOFFICIAL-Transcript.pdf')
    } catch {
      setError('Could not create the transcript. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button variant="gold" onClick={run} loading={busy}>
        <DownloadOutlined fontSize="small" /> Download unofficial transcript (PDF)
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  )
}

export default function PortalGrades() {
  const state = useApiData('/portal/grades')

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Grades & Transcript" subtitle="Your grades by semester. 1.00 is the highest grade, 3.00 is passing and 5.00 is a fail." action={<TranscriptButton />} />

      <DataGate state={state} skeleton={<Skeleton className="h-96" />}>
        {({ terms, overall }) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Cumulative GWA" value={formatGwa(overall.gwa)} hint="Every attempt counts" />
              <Stat label="Units earned" value={overall.unitsEarned} hint={overall.unitsRequired ? `of ${overall.unitsRequired} required` : undefined} />
              <Stat label="Not yet passed" value={overall.outstandingFailures.length} tone={overall.outstandingFailures.length ? 'red' : 'green'} hint={overall.outstandingFailures.map((s) => s.code).join(', ') || 'None'} />
              <Stat label="Incomplete" value={overall.incomplete.length} tone={overall.incomplete.length ? 'amber' : 'green'} hint={overall.incomplete.map((s) => s.code).join(', ') || 'None'} />
            </div>

            {terms.length === 0 && <Card>You have no classes or grades on record yet. They appear here once you are enrolled and your professors post grades.</Card>}

            {terms.map(({ term, rows, standing }) => (
              <Card
                key={term.id}
                title={term.name}
                subtitle={term.isCurrent ? 'Current semester' : undefined}
                action={
                  <span className="text-sm text-muted">
                    Semester GWA <strong className="font-serif text-lg text-navy-900">{formatGwa(standing.gwa)}</strong>
                  </span>
                }
              >
                <TableBox min={560}>
                  <thead>
                    <tr>
                      <th className={th}>Code</th>
                      <th className={th}>Subject</th>
                      <th className={`${th} text-right`}>Units</th>
                      <th className={th}>Grade</th>
                      <th className={th}>Remark</th>
                      <th className={th}>Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.subject.code}>
                        <td className={`${td} font-semibold text-navy-900`}>{r.subject.code}</td>
                        <td className={td}>
                          {r.subject.title}
                          {!r.subject.countsToGwa && <span className="block text-xs text-muted">Not counted in the GWA</span>}
                        </td>
                        <td className={`${td} text-right`}>{r.subject.units}</td>
                        <td className={`${td} font-bold text-navy-900`}>{gradeText(r.grade)}</td>
                        <td className={td}>
                          <StatusPill status={r.grade ? r.grade.remark : r.status === 'Enrolled' ? 'In progress' : r.status} />
                        </td>
                        <td className={`${td} whitespace-nowrap text-muted`}>{r.grade ? formatDay(r.grade.postedAt) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableBox>
              </Card>
            ))}

            <p className="text-xs text-muted">
              <Pill tone="amber">INC</Pill> incomplete · <Pill tone="grey">DRP</Pill> dropped · <Pill tone="grey">W</Pill> withdrawn. PE and NSTP carry units but are not counted in the GWA. The transcript you download is unofficial: request an official copy from the Registrar.
            </p>
          </>
        )}
      </DataGate>
    </div>
  )
}
