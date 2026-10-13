import { useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePreEnrollCheck } from '../../hooks/usePreEnrollCheck'
import Alert from '../../components/ui/Alert'
import { DataGate, PageTitle, Skeleton } from '../../components/portal/PortalParts'
import OfferingCard from '../../components/portal/preenroll/OfferingCard'
import RequestSummary from '../../components/portal/preenroll/RequestSummary'
import SelectionPanel from '../../components/portal/preenroll/SelectionPanel'

// The subject picker. Only mounted while the student is allowed to submit.
function Picker({ state, onSubmitted }) {
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const offerings = useApiData('/portal/pre-enrollment/offerings', { search: debounced })
  const [picked, setPicked] = useState([])
  const [onlyMine, setOnlyMine] = useState(true)
  const checkState = usePreEnrollCheck(picked.map((o) => o.id))

  const toggle = (o) =>
    setPicked((list) => {
      if (list.some((x) => x.id === o.id)) return list.filter((x) => x.id !== o.id)
      // Choosing another section of a subject you already picked swaps it.
      return [...list.filter((x) => x.subject.code !== o.subject.code), o]
    })

  const issuesFor = (id) => checkState.check?.problems.filter((p) => p.offeringId === id) ?? []

  return (
    <div className="grid items-start gap-6 pb-16 lg:grid-cols-[1fr_360px] lg:pb-0">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-navy-900">
          Find a subject
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code or title, e.g. IT205 or Networking"
            className="rounded border border-navy-100 bg-white px-3 py-2.5 text-sm font-normal text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-navy-900"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-navy-900">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-4 accent-navy-900" />
          Show only subjects recommended for my program and year
        </label>

        <DataGate state={offerings} skeleton={<Skeleton className="h-72" />}>
          {({ offerings: all }) => {
            const hasRecommended = all.some((o) => o.recommended)
            const rows = (onlyMine && hasRecommended ? all.filter((o) => o.recommended) : all).toSorted((a, b) => Number(b.selectable) - Number(a.selectable))
            return rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-navy-100 bg-white px-6 py-10 text-center text-sm text-muted">No classes match “{debounced}”.</p>
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Classes offered">
                {rows.map((o) => {
                  const sameSubject = picked.find((x) => x.subject.code === o.subject.code && x.id !== o.id)
                  return (
                    <OfferingCard
                      key={o.id}
                      offering={o}
                      picked={picked.some((x) => x.id === o.id)}
                      swapsFrom={sameSubject?.section}
                      issues={issuesFor(o.id)}
                      onToggle={() => toggle(o)}
                    />
                  )
                })}
              </ul>
            )
          }}
        </DataGate>
      </div>

      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t-[3px] border-gold-500 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,32,75,0.15)] lg:hidden">
          <span className="text-sm font-semibold text-navy-900">
            {picked.length} {picked.length === 1 ? 'subject' : 'subjects'} · {picked.reduce((n, o) => n + o.subject.units, 0)} units
          </span>
          <a href="#selection" className="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900">
            Review selection
          </a>
        </div>
      )}

      <div id="selection" className="scroll-mt-4 lg:sticky lg:top-4">
        <SelectionPanel
          picked={picked}
          onRemove={toggle}
          limits={state.limits}
          existingUnits={state.existingUnits}
          checkState={checkState}
          onSubmitted={onSubmitted}
        />
      </div>
    </div>
  )
}

export default function PortalPreEnrollment() {
  const state = useApiData('/portal/pre-enrollment')
  const [flash, setFlash] = useState('')

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Pre-Enrollment"
        subtitle="Choose your subjects for the next term. Your request goes to the Registrar for approval; you are enrolled once it is approved."
      />

      {flash && <Alert tone="success">{flash}</Alert>}

      <DataGate state={state} skeleton={<Skeleton className="h-80" />}>
        {(d) => {
          const past = d.history.filter((r) => r.id !== d.pending?.id)
          return (
            <>
              <p className="text-sm text-muted">
                {d.term ? (
                  <>
                    Open for <strong className="text-navy-900">{d.term.name}</strong>. Maximum load: {d.limits.maxUnits} units.
                  </>
                ) : (
                  'Pre-enrollment is not open right now.'
                )}
              </p>

              {d.notices.map((n) => (
                <Alert key={n.code} tone="info">{n.message}</Alert>
              ))}
              {d.blockers.map((b) => (
                <Alert key={b.code} tone={b.code === 'ALREADY_PENDING' ? 'info' : 'error'}>{b.message}</Alert>
              ))}

              {d.pending && (
                <RequestSummary
                  request={d.pending}
                  onCancelled={() => {
                    setFlash('Your request was cancelled.')
                    state.reload()
                  }}
                />
              )}

              {d.canSubmit && (
                <Picker
                  key={d.term.id}
                  state={d}
                  onSubmitted={() => {
                    setFlash('Request sent. You will see the result here and on your dashboard.')
                    state.reload()
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              )}

              {past.length > 0 && (
                <section aria-label="Earlier requests" className="flex flex-col gap-3">
                  <h2 className="font-serif text-xl font-semibold text-navy-900">Earlier requests</h2>
                  {past.map((r) => (
                    <RequestSummary key={r.id} request={r} compact onCancelled={state.reload} />
                  ))}
                </section>
              )}
            </>
          )
        }}
      </DataGate>
    </div>
  )
}
