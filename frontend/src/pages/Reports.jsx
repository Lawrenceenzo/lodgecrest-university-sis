import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined'
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/dashboard/StatCard'
import { bodyCellsSx, cardSx, headCellSx } from '../components/tableStyles'
import { ATTENDANCE_TREND, COURSES_DATA, RECENT_REPORTS } from '../data/mockData'
import { GOLD, NAVY } from '../theme'

const STATS = [
  { label: 'Total Enrolled', value: COURSES_DATA.reduce((n, c) => n + c.students, 0), icon: PeopleAltOutlined },
  { label: 'Avg. Attendance', value: '86%', icon: EventAvailableOutlined },
  { label: 'General Average', value: '1.55', icon: EditNoteOutlined },
  { label: 'Pass Rate', value: '94%', icon: TaskAltOutlined },
]

function ChartCard({ title, children }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2.5, minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      <Box sx={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </Box>
    </Paper>
  )
}

export default function Reports() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Insights" title="Reports" subtitle="Enrollment, attendance and academic performance at a glance." />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <ChartCard title="Enrollment by Course">
          <BarChart data={COURSES_DATA} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="code" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: 'rgba(15,32,75,0.06)' }} />
            <Bar dataKey="students" name="Students" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Monthly Attendance Rate (%)">
          <LineChart data={ATTENDANCE_TREND} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="rate" name="Attendance %" stroke={GOLD} strokeWidth={3} dot={{ r: 4, fill: NAVY, stroke: NAVY }} />
          </LineChart>
        </ChartCard>
      </Box>

      <Paper elevation={0} sx={cardSx}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, p: 2.5, pb: 1.5 }}>
          Recent Reports
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['Report', 'Generated', 'Format'].map((c) => (
                  <TableCell key={c} sx={headCellSx}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {RECENT_REPORTS.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.generated}</TableCell>
                  <TableCell>
                    <Chip label={r.format} size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1 }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
