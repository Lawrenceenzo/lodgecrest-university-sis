import { useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import { Card, DataGate, PageTitle, Pill, Skeleton, TableBox } from '../../components/portal/PortalParts'
import { td, th } from '../../components/portal/portalStyles'
import Timetable from '../../components/portal/Timetable'
import { formatMeetings } from '../../utils/records'

export default function PortalSchedule() {
  const [termId, setTermId] = useState('')
  const state = useApiData('/portal/schedule', { term: termId })

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="My Schedule"
        subtitle="Your week at a glance. Today is highlighted."
        action={
          state.data?.terms.length > 1 ? (
            <label className="flex flex-col gap-1 text-xs font-semibold text-navy-900">
              Term
              <select
                value={termId || state.data.term?.id || ''}
                onChange={(e) => setTermId(e.target.value)}
                className="rounded border border-navy-100 bg-white px-3 py-2 text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-navy-900"
              >
                {state.data.terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      <DataGate state={state} skeleton={<Skeleton className="h-96" />}>
        {(d) => (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              {d.term ? <span className="font-semibold text-navy-900">{d.term.name}</span> : <span>No classes yet.</span>}
              {d.term && (
                <>
                  <Pill tone="gold">{d.classes.length} {d.classes.length === 1 ? 'class' : 'classes'}</Pill>
                  <Pill tone="gold">{d.totalUnits} units</Pill>
                </>
              )}
            </div>

            <Timetable days={d.days} />

            {d.classes.length > 0 && (
              <Card title="Class list">
                <TableBox min={620}>
                  <thead>
                    <tr>
                      <th className={th}>Code</th>
                      <th className={th}>Subject</th>
                      <th className={th}>Section</th>
                      <th className={th}>Schedule</th>
                      <th className={th}>Professor</th>
                      <th className={`${th} text-right`}>Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.classes.map((c) => (
                      <tr key={c.code}>
                        <td className={`${td} font-semibold text-navy-900`}>{c.code}</td>
                        <td className={td}>{c.title}</td>
                        <td className={td}>{c.section}</td>
                        <td className={td}>{formatMeetings(c.meetings)}</td>
                        <td className={td}>{c.professor}</td>
                        <td className={`${td} text-right`}>{c.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableBox>
              </Card>
            )}
          </>
        )}
      </DataGate>
    </div>
  )
}
