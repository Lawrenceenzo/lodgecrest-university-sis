import { useState } from 'react'
import { Alert, Box, Button, LinearProgress, MenuItem, Paper, Select, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import PageHeader from '../components/PageHeader'
import TablePager from '../components/TablePager'
import StatusChip from '../components/students/StatusChip'
import { StatTile } from '../components/students/records/RecordsParts'
import { tileGridSx } from '../components/students/records/recordStyles'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../components/tableStyles'
import { useApiData } from '../hooks/useApiData'
import { useApiList } from '../hooks/useApiList'
import { useCourseOptions } from '../hooks/useCourseOptions'
import { formatGwa } from '../utils/records'
import { pageWindow } from '../utils/paginate'
import { SECTIONS, YEAR_LEVELS } from '../utils/students'

const COLUMNS = ['Student ID', 'Name', 'Class', 'Subject', 'Units', 'Grade', 'Remark']
const PAGE_SIZE = 10
const selectSx = { minWidth: 150, fontSize: 13, bgcolor: '#fff' }

// "All Courses" style dropdown: '' means no filter.
function Filter({ label, value, onChange, options }) {
  return (
    <Select size="small" displayEmpty value={value} onChange={(e) => onChange(e.target.value)} sx={selectSx} inputProps={{ 'aria-label': label }}>
      <MenuItem value="">{`All ${label}s`}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {o}
        </MenuItem>
      ))}
    </Select>
  )
}

const gradeText = (r) => (r.value !== null ? r.value.toFixed(2) : r.mark)

export default function Grades() {
  const terms = useApiList('/terms')
  const courses = useCourseOptions()
  const [termId, setTermId] = useState('') // '' = the current semester
  const [course, setCourse] = useState('')
  const [section, setSection] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [page, setPage] = useState(1)

  // Every change of a filter asks the server again, so the table AND the summary always match the selection.
  const state = useApiData('/grades', { term: termId, course, section, yearLevel })
  const data = state.data

  const pick = (setter) => (value) => {
    setter(value)
    setPage(1)
  }
  const filtered = Boolean(course || section || yearLevel)
  const clear = () => {
    setCourse('')
    setSection('')
    setYearLevel('')
    setPage(1)
  }

  const rows = data?.rows ?? []
  const { start, end } = pageWindow(rows.length, page, PAGE_SIZE)
  const visible = rows.slice(start, end)
  const s = data?.summary
  const selectedTerm = termId || data?.term?.id || ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Academics" title="Grades" subtitle="Posted grades for the selected semester. Narrow them by course, section or year level." />

      {state.error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={state.reload}>Retry</Button>}>
          {state.error}
        </Alert>
      )}

      <Box sx={tileGridSx}>
        <StatTile label="Students" value={s ? s.students : '-'} hint="with a grade posted" />
        <StatTile label="Grades posted" value={s ? s.records : '-'} />
        <StatTile label="GWA" value={s ? formatGwa(s.gwa) : '-'} hint="1.00 best, 3.00 passing" />
        <StatTile
          label="Passed / Failed"
          value={s ? `${s.passed} / ${s.failed}` : '-'}
          tone={s && s.failed > 0 ? 'error.main' : undefined}
          hint={s?.passRate !== null && s ? `${s.passRate}% pass rate` : 'No numeric grades'}
        />
      </Box>

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <Select size="small" displayEmpty value={selectedTerm} onChange={(e) => pick(setTermId)(e.target.value)} sx={{ ...selectSx, minWidth: 210 }} inputProps={{ 'aria-label': 'Semester' }}>
            {!selectedTerm && <MenuItem value="">Loading…</MenuItem>}
            {terms.rows.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
                {t.isCurrent ? ' (current)' : ''}
              </MenuItem>
            ))}
          </Select>
          <Filter label="Course" value={course} onChange={pick(setCourse)} options={courses.codes} />
          <Filter label="Section" value={section} onChange={pick(setSection)} options={SECTIONS} />
          <Filter label="Year Level" value={yearLevel} onChange={pick(setYearLevel)} options={YEAR_LEVELS} />
          {filtered && (
            <Button size="small" onClick={clear}>
              Clear filters
            </Button>
          )}
        </Box>
        {state.loading && data && <LinearProgress />}

        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell key={c} sx={headCellSx} align={c === 'Units' ? 'right' : 'left'}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {!data && !state.error && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Skeleton variant="rounded" height={120} />
                  </TableCell>
                </TableRow>
              )}
              {data && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length}>
                    <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                      No grades posted for {data.term?.name ?? 'this semester'}
                      {filtered ? ' with these filters.' : '.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {visible.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.student.studentId}</TableCell>
                  <TableCell>{r.student.name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{`${r.student.course}-${r.student.yearLevel?.[0] ?? ''}${r.student.section}`}</TableCell>
                  <TableCell>
                    <Box component="span" sx={{ fontWeight: 600 }}>{r.subject.code}</Box> · {r.subject.title}
                    {!r.subject.countsToGwa && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        Not counted in the GWA
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{r.subject.units}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{gradeText(r)}</TableCell>
                  <TableCell>
                    <StatusChip status={r.remark} />
                  </TableCell>
                </TableRow>
              ))}
              {s && s.records > 0 && (
                <TableRow sx={{ '& td': { bgcolor: '#e4f6ea', fontWeight: 700, borderBottom: 0 } }}>
                  <TableCell colSpan={COLUMNS.length - 2}>General Average (GWA){filtered ? ' of this selection' : ''}</TableCell>
                  <TableCell colSpan={2}>{formatGwa(s.gwa)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {data?.truncated && (
          <Alert severity="info" sx={{ m: 2 }}>
            Only the first 1,000 grades are listed. The summary above still counts all of them. Narrow the filters to see the rest.
          </Alert>
        )}
        <TablePager total={rows.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Paper>
    </Box>
  )
}
