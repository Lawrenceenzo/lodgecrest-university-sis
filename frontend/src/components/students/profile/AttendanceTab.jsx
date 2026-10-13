import { useState } from 'react'
import { Box, Button, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import api from '../../../api/axios'
import ConfirmDialog from '../../ConfirmDialog'
import { FormSelect } from '../../FormControls'
import IconAction from '../../IconAction'
import TablePager from '../../TablePager'
import { useApiData } from '../../../hooks/useApiData'
import { useApiList } from '../../../hooks/useApiList'
import { apiError, formatDay } from '../../../utils/records'
import { NAVY } from '../../../theme'
import StatusChip from '../StatusChip'
import AttendanceDialog from '../records/AttendanceDialog'
import { DataState, EmptyNote, SectionHeader, StatTile } from '../records/RecordsParts'
import { cellSx, recordHeadSx, tableWrapSx, tileGridSx } from '../records/recordStyles'

const PAGE_SIZE = 10
const rateColor = (rate) => (rate === null ? 'text.secondary' : rate >= 90 ? 'success.main' : rate >= 75 ? '#c76a05' : 'error.main')

export default function AttendanceTab({ student, readOnly, notify }) {
  const terms = useApiList('/terms')
  const [termId, setTermId] = useState('') // '' = the current term
  const state = useApiData(`/students/${student.id}/attendance`, { term: termId })
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null) // { record? }
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)

  const shownTerm = state.data?.term
  const termOptions = terms.rows.map((t) => ({ value: t.id, label: t.name + (t.isCurrent ? ' (current)' : '') }))

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/attendance/${removing.id}`)
      notify({ severity: 'success', message: 'Attendance record removed.' })
      state.reload()
    } catch (err) {
      notify({ severity: 'error', message: apiError(err, 'Could not remove the record.') })
    } finally {
      setRemoving(null)
      setBusy(false)
    }
  }

  return (
    <Box>
      <SectionHeader
        title="Attendance"
        subtitle="One record per class and day. Re-saving a day updates it."
        action={
          <Button variant="contained" color="secondary" startIcon={<AddOutlined />} onClick={() => setDialog({})} disabled={readOnly || !shownTerm}>
            Record attendance
          </Button>
        }
      />
      <Box sx={{ maxWidth: 320, mb: 3 }}>
        <FormSelect
          name="attendance-term"
          label="Term"
          value={termId || shownTerm?.id || ''}
          onChange={(e) => {
            setTermId(e.target.value)
            setPage(1)
          }}
          options={termOptions}
          disabled={terms.firstLoad}
        />
      </Box>

      <DataState state={state}>
        {({ totals, byClass, records }) => {
          const current = Math.min(page, Math.max(1, Math.ceil(records.length / PAGE_SIZE)))
          const pageRows = records.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box sx={tileGridSx}>
                <StatTile label="Attendance rate" value={totals.rate === null ? '-' : `${totals.rate}%`} tone={rateColor(totals.rate)} hint={`${totals.total} ${totals.total === 1 ? 'record' : 'records'}`} />
                <StatTile label="Present" value={totals.Present} tone="success.main" hint={`Late ${totals.Late}`} />
                <StatTile label="Absent" value={totals.Absent} tone={totals.Absent ? 'error.main' : undefined} />
                <StatTile label="Excused" value={totals.Excused} />
              </Box>

              {records.length === 0 ? (
                <EmptyNote>No attendance recorded for {shownTerm?.name ?? 'this term'}.</EmptyNote>
              ) : (
                <>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>By class</Typography>
                    <Box sx={tableWrapSx}>
                      <Table size="small" sx={{ minWidth: 620 }}>
                        <TableHead sx={recordHeadSx}>
                          <TableRow>
                            <TableCell>Class</TableCell>
                            <TableCell align="right">Present</TableCell>
                            <TableCell align="right">Late</TableCell>
                            <TableCell align="right">Excused</TableCell>
                            <TableCell align="right">Absent</TableCell>
                            <TableCell sx={{ width: 170 }}>Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody sx={cellSx}>
                          {byClass.map((c) => (
                            <TableRow key={c.offeringId}>
                              <TableCell>
                                <Box component="span" sx={{ fontWeight: 600 }}>{c.subject.code}</Box> · {c.subject.title}
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  Section {c.section}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">{c.Present}</TableCell>
                              <TableCell align="right">{c.Late}</TableCell>
                              <TableCell align="right">{c.Excused}</TableCell>
                              <TableCell align="right">{c.Absent}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={c.rate ?? 0}
                                    aria-label={`${c.subject.code} attendance rate`}
                                    sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#eef1f7', '& .MuiLinearProgress-bar': { bgcolor: NAVY, borderRadius: 3 } }}
                                  />
                                  <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 34, textAlign: 'right', color: rateColor(c.rate) }}>
                                    {c.rate}%
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 1 }}>All records</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 620 }}>
                          <TableHead sx={recordHeadSx}>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Class</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Remarks</TableCell>
                              <TableCell align="right" sx={{ width: 96 }} />
                            </TableRow>
                          </TableHead>
                          <TableBody sx={cellSx}>
                            {pageRows.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(r.date)}</TableCell>
                                <TableCell>
                                  <Box component="span" sx={{ fontWeight: 600 }}>{r.subject.code}</Box> · Sec {r.section}
                                </TableCell>
                                <TableCell>
                                  <StatusChip status={r.status} />
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary' }}>{r.remarks || '-'}</TableCell>
                                <TableCell align="right">
                                  {!readOnly && (
                                    <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                                      <IconAction label={`Edit ${r.subject.code} on ${formatDay(r.date)}`} color={NAVY} onClick={() => setDialog({ record: r })}>
                                        <EditOutlined sx={{ fontSize: 18 }} />
                                      </IconAction>
                                      <IconAction label={`Remove ${r.subject.code} on ${formatDay(r.date)}`} color="#c62828" onClick={() => setRemoving(r)}>
                                        <DeleteOutlined sx={{ fontSize: 18 }} />
                                      </IconAction>
                                    </Box>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                      <TablePager total={records.length} page={current} pageSize={PAGE_SIZE} onChange={setPage} />
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          )
        }}
      </DataState>

      {dialog && shownTerm && (
        <AttendanceDialog
          student={student}
          term={shownTerm}
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSaved={(wasEdit) => {
            setDialog(null)
            notify({ severity: 'success', message: wasEdit ? 'Attendance updated.' : 'Attendance saved.' })
            state.reload()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this record?"
        message={removing ? `${removing.subject.code} · ${formatDay(removing.date)} (${removing.status}) will be deleted.` : ''}
        confirmLabel="Remove"
        busyLabel="Removing…"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </Box>
  )
}
