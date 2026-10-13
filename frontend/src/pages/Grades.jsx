import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import PageHeader from '../components/PageHeader'
import { StaticSelect } from '../components/StaticControls'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../components/tableStyles'
import { GRADES, SEMESTERS } from '../data/mockData'
import { COURSES, SECTIONS } from '../utils/students'

const COLUMNS = ['Subject Code', 'Subject Name', 'Units', 'Grade']
const opts = (all, items) => [{ value: '', label: all }, ...items.map((i) => ({ value: i, label: i }))]

const generalAverage = GRADES.reduce((sum, g) => sum + g.grade, 0) / GRADES.length

export default function Grades() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader eyebrow="Academics" title="Grades" subtitle="View student grades for the selected semester." />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <StaticSelect ariaLabel="Semester" minWidth={210} options={SEMESTERS.map((s) => ({ value: s, label: s }))} />
          <StaticSelect ariaLabel="Course" options={opts('All Courses', COURSES)} />
          <StaticSelect ariaLabel="Section" options={opts('All Sections', SECTIONS)} />
        </Box>

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
              {GRADES.map((g) => (
                <TableRow key={g.code} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{g.code}</TableCell>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{g.units}</TableCell>
                  <TableCell>{g.grade.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ '& td': { bgcolor: '#e4f6ea', fontWeight: 700, borderBottom: 0 } }}>
                <TableCell colSpan={3}>General Average</TableCell>
                <TableCell>{generalAverage.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
