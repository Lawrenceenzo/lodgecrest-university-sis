import { Box, Button, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined'
import SearchIcon from '@mui/icons-material/Search'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import StatusChip from '../components/students/StatusChip'
import { StaticSelect, StaticTableFooter } from '../components/StaticControls'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../components/tableStyles'
import { ATTENDANCE_LOG, ATTENDANCE_LOG_TOTAL, ATTENDANCE_SUMMARY, GRADES } from '../data/mockData'
import { SECTIONS } from '../utils/students'

const COLUMNS = ['Date', 'Subject Name', 'Status']
const total = ATTENDANCE_SUMMARY.reduce((sum, s) => sum + s.value, 0)
const present = ATTENDANCE_SUMMARY.find((s) => s.label === 'Present').value
const presentPct = Math.floor((present / total) * 100)

const subjectOptions = [{ value: '', label: 'All Subjects' }, ...GRADES.map((g) => ({ value: g.code, label: g.code }))]
const sectionOptions = [{ value: '', label: 'All Sections' }, ...SECTIONS.map((s) => ({ value: s, label: s }))]

function DonutCard() {
  const slices = ATTENDANCE_SUMMARY.filter((s) => s.value > 0)
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row', lg: 'column' }, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <Box sx={{ position: 'relative', width: 190, height: 190, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius={62} outerRadius={88} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <Typography component="span" sx={{ fontSize: 32, fontWeight: 700 }}>
            {presentPct}%
          </Typography>
        </Box>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 150 }}>
        {ATTENDANCE_SUMMARY.map((s) => (
          <Box component="li" key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 13 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
            <Box sx={{ flex: 1 }}>{s.label}</Box>
            <Box sx={{ fontWeight: 700 }}>{s.value}</Box>
          </Box>
        ))}
      </Box>
    </Paper>
  )
}

export default function Attendance() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Academics" title="Attendance" subtitle="Track attendance for the selected period." />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <TextField
            size="small"
            defaultValue="Aug 1, 2026 - Aug 31, 2026"
            sx={{ minWidth: 240, '& .MuiInputBase-root': { fontSize: 13, bgcolor: '#fff' } }}
            slotProps={{
              htmlInput: { 'aria-label': 'Date range' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <StaticSelect ariaLabel="Subject" options={subjectOptions} />
          <StaticSelect ariaLabel="Section" options={sectionOptions} />
          <Button variant="contained" startIcon={<SearchIcon />}>
            Search
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Paper elevation={0} sx={{ ...cardSx, minWidth: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableCell key={c} sx={headCellSx}>
                      {c}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={bodyCellsSx}>
                {ATTENDANCE_LOG.map((r) => (
                  <TableRow key={`${r.date}-${r.subject}`} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.date}</TableCell>
                    <TableCell>{r.subject}</TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <StaticTableFooter label={`Showing 1-${ATTENDANCE_LOG.length} of ${ATTENDANCE_LOG_TOTAL}`} pages={5} />
        </Paper>

        <DonutCard />
      </Box>
    </Box>
  )
}
