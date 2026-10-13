import {
  Avatar,
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined'
import RestoreFromTrashOutlined from '@mui/icons-material/RestoreFromTrashOutlined'
import DeleteForeverOutlined from '@mui/icons-material/DeleteForeverOutlined'
import { assetUrl } from '../../api/axios'
import { fullName } from '../../utils/students'
import IconAction from '../IconAction'
import { bodyCellsSx, headCellSx } from '../tableStyles'
import StatusChip from './StatusChip'
import { isArchived, isInactive } from '../../utils/lifecycle'

const COLUMNS = ['Student ID', 'Name', 'Course', 'Year Level', 'Section', 'Status', 'Actions']

export default function StudentsTable({ rows, loading, emptyMessage = 'No students match your search.', onView, onEdit, onArchive, onRestore, onDeletePermanently }) {
  return (
    <TableContainer>
      <Table size="medium" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            {COLUMNS.map((c) => (
              <TableCell key={c} sx={headCellSx} align={c === 'Actions' ? 'center' : 'left'}>
                {c}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody sx={bodyCellsSx}>
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                {COLUMNS.map((c) => (
                  <TableCell key={c}>
                    <Skeleton width={c === 'Name' ? 140 : 70} />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length}>
                <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            rows.map((s) => (
              <TableRow key={s.id} hover sx={isInactive(s) ? { '& > td': { opacity: 0.72 } } : undefined}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.studentId}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Avatar
                      src={assetUrl(s.profilePicture) || undefined}
                      alt=""
                      sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13, flexShrink: 0 }}
                    >
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </Avatar>
                    <Box component="span" sx={{ fontWeight: 500 }}>
                      {fullName(s)}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{s.course}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.yearLevel}</TableCell>
                <TableCell>{s.section}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <StatusChip status={s.status} />
                    {s.academicStatus && s.academicStatus !== 'Enrolled' && <StatusChip status={s.academicStatus} />}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75 }}>
                    <IconAction label={`View ${fullName(s)}`} color="#1d4ed8" onClick={() => onView(s)}>
                      <VisibilityOutlined sx={{ fontSize: 17 }} />
                    </IconAction>
                    {isArchived(s) ? (
                      <>
                        <IconAction label={`Restore ${fullName(s)}`} color="#15803d" onClick={() => onRestore(s)}>
                          <RestoreFromTrashOutlined sx={{ fontSize: 17 }} />
                        </IconAction>
                        <IconAction label={`Permanently delete ${fullName(s)}`} color="#dc2626" onClick={() => onDeletePermanently(s)}>
                          <DeleteForeverOutlined sx={{ fontSize: 17 }} />
                        </IconAction>
                      </>
                    ) : (
                      <>
                        <IconAction label={`Edit ${fullName(s)}`} color="#0f204b" onClick={() => onEdit(s)}>
                          <EditOutlined sx={{ fontSize: 17 }} />
                        </IconAction>
                        <IconAction label={`Archive ${fullName(s)}`} color="#b45309" onClick={() => onArchive(s)}>
                          <ArchiveOutlined sx={{ fontSize: 17 }} />
                        </IconAction>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
