import { useState } from 'react'
import { Alert, Box, Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined'
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined'
import api from '../../../api/axios'
import ConfirmDialog from '../../ConfirmDialog'
import IconAction from '../../IconAction'
import { useApiData } from '../../../hooks/useApiData'
import { apiError, formatDay, formatMeetings, gradeText } from '../../../utils/records'
import StatusChip from '../StatusChip'
import EnrollDialog from '../records/EnrollDialog'
import SampleRecordsDialog from '../SampleRecordsDialog'
import { DataState, EmptyNote, SectionHeader } from '../records/RecordsParts'
import { cellSx, recordHeadSx, tableWrapSx } from '../records/recordStyles'

export default function EnrollmentHistoryTab({ student, readOnly, notify, onStudentChanged }) {
  const state = useApiData(`/students/${student.id}/enrollments`)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [dropping, setDropping] = useState(null)
  const [sampleOpen, setSampleOpen] = useState(false)
  const [removingSample, setRemovingSample] = useState(false)
  const [busy, setBusy] = useState(false)

  const drop = async () => {
    setBusy(true)
    try {
      await api.post(`/enrollments/${dropping.id}/drop`)
      notify({ severity: 'success', message: `${dropping.subject.code} was dropped.` })
      setDropping(null)
      state.reload()
    } catch (err) {
      notify({ severity: 'error', message: apiError(err, 'Could not drop the class.') })
      setDropping(null)
    } finally {
      setBusy(false)
    }
  }

  const removeSample = async () => {
    setBusy(true)
    try {
      await api.delete(`/students/${student.id}/sample-records`)
      notify({ severity: 'success', message: 'The generated sample records were removed.' })
      state.reload()
      onStudentChanged()
    } catch (err) {
      notify({ severity: 'error', message: apiError(err, 'Could not remove the sample records.') })
    } finally {
      setRemovingSample(false)
      setBusy(false)
    }
  }

  return (
    <Box>
      {student.sampleRecordsAt && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            !readOnly && (
              <Button color="inherit" size="small" onClick={() => setRemovingSample(true)}>
                Remove sample records
              </Button>
            )
          }
        >
          This record contains generated sample classes and grades (demo data), added {formatDay(student.sampleRecordsAt)}.
        </Alert>
      )}
      <SectionHeader
        title="Enrollment history"
        subtitle="Every class this student has taken, newest term first."
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<AutoFixHighOutlined />} onClick={() => setSampleOpen(true)} disabled={readOnly}>
              Generate sample records
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddOutlined />} onClick={() => setEnrollOpen(true)} disabled={readOnly}>
              Enroll in a class
            </Button>
          </Box>
        }
      />
      <DataState state={state}>
        {({ terms }) =>
          terms.length === 0 ? (
            <EmptyNote>No enrollments yet, so the student&apos;s portal is empty. Use “Enroll in a class”, or “Generate sample records” to fill it in.</EmptyNote>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {terms.map(({ term, units, enrollments }) => (
                <Box key={term.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700 }}>{term.name}</Typography>
                    {term.isCurrent && <Chip size="small" label="Current term" color="secondary" sx={{ fontWeight: 600 }} />}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {units} units
                    </Typography>
                  </Box>
                  <Box sx={tableWrapSx}>
                    <Table size="small" sx={{ minWidth: 760 }}>
                      <TableHead sx={recordHeadSx}>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Subject</TableCell>
                          <TableCell>Section</TableCell>
                          <TableCell>Schedule</TableCell>
                          <TableCell>Professor</TableCell>
                          <TableCell align="right">Units</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Grade</TableCell>
                          <TableCell align="right" />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={cellSx}>
                        {enrollments.map((r) => (
                          <TableRow key={r.id} sx={r.status === 'Dropped' ? { opacity: 0.6 } : undefined}>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.subject.code}</TableCell>
                            <TableCell>{r.subject.title}</TableCell>
                            <TableCell>{r.offering.section}</TableCell>
                            <TableCell sx={{ minWidth: 190 }}>{formatMeetings(r.offering.meetings)}</TableCell>
                            <TableCell>{r.offering.professor}</TableCell>
                            <TableCell align="right">{r.subject.units}</TableCell>
                            <TableCell>
                              <StatusChip status={r.status} />
                            </TableCell>
                            <TableCell>{gradeText(r.grade)}</TableCell>
                            <TableCell align="right">
                              {r.status === 'Enrolled' && !readOnly && (
                                <IconAction label={`Drop ${r.subject.code}`} color="#c62828" onClick={() => setDropping(r)}>
                                  <RemoveCircleOutlineOutlined sx={{ fontSize: 18 }} />
                                </IconAction>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              ))}
            </Box>
          )
        }
      </DataState>

      {enrollOpen && (
        <EnrollDialog
          student={student}
          onClose={() => setEnrollOpen(false)}
          onEnrolled={(code) => {
            setEnrollOpen(false)
            notify({ severity: 'success', message: `Enrolled in ${code}.` })
            state.reload()
          }}
        />
      )}
      {sampleOpen && (
        <SampleRecordsDialog
          student={student}
          onClose={() => setSampleOpen(false)}
          onDone={(message) => {
            setSampleOpen(false)
            notify({ severity: 'success', message })
            state.reload()
            onStudentChanged()
          }}
        />
      )}
      <ConfirmDialog
        open={removingSample}
        title="Remove sample records?"
        message="This deletes ALL of this student's enrollments, grades and attendance, and gives their seats back. Charges, payments and holds are kept."
        confirmLabel="Remove"
        busyLabel="Removing…"
        busy={busy}
        onCancel={() => setRemovingSample(false)}
        onConfirm={removeSample}
      />
      <ConfirmDialog
        open={Boolean(dropping)}
        title="Drop this class?"
        message={dropping ? `${dropping.subject.code} · ${dropping.subject.title} will be marked Dropped and the seat is given back. The record stays in the history.` : ''}
        confirmLabel="Drop class"
        busyLabel="Dropping…"
        busy={busy}
        onCancel={() => setDropping(null)}
        onConfirm={drop}
      />
    </Box>
  )
}
