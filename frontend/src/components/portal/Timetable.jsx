import { formatTime, FULL_DAY, toMinutes, todayName } from '../../utils/records'

const HOUR_PX = 56
const COLORS = [
  'bg-navy-900 text-white border-navy-950',
  'bg-gold-100 text-navy-950 border-gold-500',
  'bg-navy-100 text-navy-950 border-navy-700',
  'bg-gold-500 text-navy-950 border-gold-700',
  'bg-navy-700 text-white border-navy-900',
]
// The same subject always gets the same colour.
const indexFor = (code) => [...code].reduce((n, ch) => n + ch.charCodeAt(0), 0) % COLORS.length
const colorFor = (code) => COLORS[indexFor(code)]
const STRIPS = ['bg-navy-900', 'bg-gold-500', 'bg-navy-700', 'bg-gold-700', 'bg-navy-950']

// Weekly timetable. Wide screens: a time grid with one column per day. Phones: one card per day.
// `days` is [{ day, classes: [{ code, title, section, professor, room, start, end }] }] from the API.
export default function Timetable({ days }) {
  const today = todayName()
  const hasSaturday = days.find((d) => d.day === 'Sat')?.classes.length > 0
  const shown = days.filter((d) => d.day !== 'Sat' || hasSaturday)
  const all = shown.flatMap((d) => d.classes)

  if (all.length === 0) {
    return <p className="rounded-md border border-dashed border-navy-100 bg-white px-6 py-12 text-center text-sm text-muted">No classes scheduled for this term.</p>
  }

  const first = Math.floor(Math.min(...all.map((c) => toMinutes(c.start))) / 60)
  const last = Math.ceil(Math.max(...all.map((c) => toMinutes(c.end))) / 60)
  const hours = Array.from({ length: last - first }, (_, i) => first + i)
  const gridHeight = hours.length * HOUR_PX

  return (
    <>
      {/* Wide screens */}
      <div className="hidden overflow-x-auto rounded-md border border-navy-100 bg-white md:block">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `76px repeat(${shown.length}, minmax(0, 1fr))` }}>
          <div className="border-b border-navy-100 bg-navy-50" />
          {shown.map((d) => (
            <div
              key={d.day}
              className={`border-b border-l border-navy-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider ${d.day === today ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-900'}`}
            >
              {FULL_DAY[d.day]}
            </div>
          ))}

          <div className="relative" style={{ height: gridHeight }} aria-hidden="true">
            {hours.map((h, i) => (
              <div key={h} className="absolute right-2 whitespace-nowrap text-[11px] text-muted" style={{ top: i * HOUR_PX + 3 }}>
                {formatTime(`${String(h).padStart(2, '0')}:00`)}
              </div>
            ))}
          </div>
          {shown.map((d) => (
            <div key={d.day} className={`relative border-l border-navy-100 ${d.day === today ? 'bg-gold-50' : ''}`} style={{ height: gridHeight }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-navy-100/70" style={{ top: i * HOUR_PX }} />
              ))}
              {d.classes.map((c) => {
                const top = ((toMinutes(c.start) - first * 60) / 60) * HOUR_PX
                const height = Math.max(((toMinutes(c.end) - toMinutes(c.start)) / 60) * HOUR_PX - 2, 22)
                return (
                  <div
                    key={`${c.code}-${c.start}`}
                    className={`absolute inset-x-1 overflow-hidden rounded border-l-4 px-2 py-1 text-xs leading-tight shadow-sm ${colorFor(c.code)}`}
                    style={{ top: top + 1, height }}
                    title={`${c.code} ${c.title}, ${formatTime(c.start)}-${formatTime(c.end)}${c.room ? `, ${c.room}` : ''}, ${c.professor}`}
                  >
                    <div className="font-bold">{c.code}</div>
                    {height >= 40 && (
                      <div className="opacity-90">
                        {formatTime(c.start)}-{formatTime(c.end)}
                      </div>
                    )}
                    {height >= 58 && c.room && <div className="opacity-90">{c.room}</div>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Phones */}
      <div className="flex flex-col gap-3 md:hidden">
        {shown
          .filter((d) => d.classes.length > 0)
          .map((d) => (
            <section key={d.day} className={`rounded-md border bg-white ${d.day === today ? 'border-gold-500' : 'border-navy-100'}`}>
              <h3 className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${d.day === today ? 'bg-gold-100 text-gold-700' : 'bg-navy-50 text-navy-900'}`}>
                {FULL_DAY[d.day]}
                {d.day === today && ' · Today'}
              </h3>
              <ul className="divide-y divide-navy-100">
                {d.classes.map((c) => (
                  <li key={`${c.code}-${c.start}`} className="flex gap-3 px-4 py-3">
                    <div className={`w-1.5 shrink-0 rounded ${STRIPS[indexFor(c.code)]}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900">
                        {c.code} <span className="font-normal text-muted">· {c.title}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {formatTime(c.start)}-{formatTime(c.end)}
                        {c.room && ` · ${c.room}`} · {c.professor}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </>
  )
}
