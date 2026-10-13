import { useState } from 'react'
import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import AddOutlined from '@mui/icons-material/AddOutlined'
import api from '../../../api/axios'
import ConfirmDialog from '../../ConfirmDialog'
import IconAction from '../../IconAction'
import { useApiData } from '../../../hooks/useApiData'
import { apiError, formatDay, formatGwa, gradeText } from '../../../utils/records'
import { NAVY } from '../../../theme'
import StatusChip from '../StatusChip'
import GradeDialog from '../records/GradeDialog'
import { DataState, EmptyNote, SectionHeader, StatTile } from '../records/RecordsParts'
import { cellSx, recordHeadSx, tableWrapSx, tileGridSx } from '../records/recordStyles'

export default function GradesTab({ student, readOnly, notify }) {
  const state = useApiData(`/students/${student.id}/grades`)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)

  const removeGrade = async () => {
    setBusy(true)
    try {
      await api.delete(`/enrollments/${removing.id}/grade`)
      notify({ severity: 'success', message: `Grade for ${removing.subject.code} removed. The class is back in progress.` })
      state.reload()
    } catch (err) {
      notify({ severity: 'error', message: apiError(err, 'Could not remove the grade.') })
    } finally {
      setRemoving(null)
      setBusy(false)
    }
  }

  return (
    <Box>
      <SectionHeader title="Grades" subtitle="Final grades by term. 1.00 is the best, 3.00 the passing mark, 5.00 a fail." />
      <DataState state={state}>
        {({ terms, overall }) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box sx={tileGridSx}>
              <StatTile label="Cumulative GWA" value={formatGwa(overall.gwa)} hint="Every numeric attempt counts" />
              <StatTile label="Units earned" value={overall.unitsEarned} hint={overall.unitsRequired ? `of ${overall.unitsRequired}` : undefined} />
              <StatTile label="Not yet passed" value={overall.outstandingFailures.length} tone={overall.outstandingFailures.length ? 'error.main' : 'success.main'} hint={overall.outstandingFailures.map((s) => s.code).join(', ') || 'None'} />
              <StatTile label="Incomplete" value={overall.incomplete.length} tone={overall.incomplete.length ? '#c76a05' : 'success.main'} hint={overall.incomplete.map((s) => s.code).join(', ') || 'None'} />
            </Box>

            {terms.length === 0 && <EmptyNote>No classes yet, so there are no grades to show.</EmptyNote>}

            {terms.map(({ term, rows, standing }) => (
              <Box key={term.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700 }}>{term.name}</Typography>
                  {term.isCurrent && <Chip size="small" label="Current term" color="secondary" sx={{ fontWeight: 600 }} />}
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Term GWA <Box component="span" sx={{ fontWeight: 700, color: NAVY }}>{formatGwa(standing.gwa)}</Box>
                  </Typography>
                </Box>
                <Box sx={tableWrapSx}>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead sx={recordHeadSx}>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell align="right">Units</TableCell>
                        <TableCell>Grade</TableCell>
                        <TableCell>Remark</TableCell>
                        <TableCell>Posted</TableCell>
                        <TableCell align="right" sx={{ width: 96 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody sx={cellSx}>
                      {rows.map((r) => {
                        const dropMark = r.grade?.mark === 'DRP' || r.grade?.mark === 'W'
                        const gradable = r.status !== 'Dropped' && !readOnly
                        return (
                          <TableRow key={r.id}>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.subject.code}</TableCell>
                            <TableCell>
                              {r.subject.title}
                              {!r.subject.countsToGwa && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  Not counted in the GWA
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{r.subject.units}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{gradeText(r.grade)}</TableCell>
                            <TableCell>{r.grade ? <StatusChip status={r.grade.remark} /> : <StatusChip status={r.status === 'Dropped' ? 'Dropped' : 'Enrolled'} />}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.grade ? formatDay(r.grade.postedAt) : '-'}</TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                                {gradable && (
                                  <IconAction label={r.grade ? `Edit grade for ${r.subject.code}` : `Enter grade for ${r.subject.code}`} color={NAVY} onClick={() => setEditing(r)}>
                                    {r.grade ? <EditOutlined sx={{ fontSize: 18 }} /> : <AddOutlined sx={{ fontSize: 18 }} />}
                                  </IconAction>
                                )}
                                {gradable && r.grade && !dropMark && (
                                  <IconAction label={`Remove grade for ${r.subject.code}`} color="#c62828" onClick={() => setRemoving(r)}>
                                    <DeleteOutlined sx={{ fontSize: 18 }} />
                                  </IconAction>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DataState>

      {editing && (
        <GradeDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(row, shown) => {
            setEditing(null)
            notify({ severity: 'success', message: `${row.subject.code} graded ${shown}.` })
            state.reload()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this grade?"
        message={removing ? `The grade for ${removing.subject.code} will be deleted and the class goes back to in progress.` : ''}
        confirmLabel="Remove grade"
        busyLabel="Removing…"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={removeGrade}
      />
    </Box>
  )
}
