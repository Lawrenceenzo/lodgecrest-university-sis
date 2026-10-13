import { useMemo, useState } from 'react'
import { Box, MenuItem, Paper, Select, Skeleton, Typography } from '@mui/material'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { NAVY } from '../../theme'
import { YEAR_LEVELS } from '../../utils/students'

export default function PopulationChart({ students, loading }) {
  const [yearLevel, setYearLevel] = useState('all')

  const data = useMemo(
    () =>
      YEAR_LEVELS.filter((y) => yearLevel === 'all' || y === yearLevel).map((y) => ({
        name: y,
        students: students.filter((s) => s.yearLevel === y).length,
      })),
    [students, yearLevel],
  )

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Student Population
        </Typography>
        <Select
          size="small"
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          sx={{ fontSize: 13, minWidth: 140 }}
          inputProps={{ 'aria-label': 'Filter by year level' }}
        >
          <MenuItem value="all">All Year Levels</MenuItem>
          {YEAR_LEVELS.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {loading ? (
        <Skeleton variant="rounded" height={260} />
      ) : (
        <Box sx={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(15,32,75,0.06)' }} />
              <Bar dataKey="students" name="Students" fill={NAVY} radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}
