import { Alert, Box, Chip, LinearProgress, Typography } from '@mui/material'
import { useApiData } from '../../../hooks/useApiData'
import { formatGwa, peso } from '../../../utils/records'
import { GOLD } from '../../../theme'
import StatusChip from '../StatusChip'
import { Section } from './PersonalInfoTab'
import { DataState, StatTile } from '../records/RecordsParts'
import { tileGridSx } from '../records/recordStyles'

export default function AcademicInfoTab({ student }) {
  const state = useApiData(`/students/${student.id}/academic-summary`)

  return (
    <DataState state={state}>
      {(d) => {
        const { standing, program, currentLoad, currentTerm } = d
        const required = standing.unitsRequired
        const pct = required ? Math.min(100, Math.round((standing.unitsEarned / required) * 100)) : 0
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.activeHolds > 0 && (
              <Alert severity="warning">
                {d.activeHolds === 1 ? '1 active hold' : `${d.activeHolds} active holds`} on this account. See the Accounts &amp; Holds tab.
              </Alert>
            )}

            <Box sx={tileGridSx}>
              <StatTile label="GWA" value={formatGwa(standing.gwa)} hint="1.00 best, 3.00 passing" />
              <StatTile label="Units earned" value={standing.unitsEarned} hint={required ? `of ${required} required` : 'No program linked'} />
              <StatTile
                label="Current load"
                value={`${currentLoad.units} units`}
                hint={`${currentLoad.subjects} ${currentLoad.subjects === 1 ? 'class' : 'classes'}${currentTerm ? ` · ${currentTerm.name}` : ''}`}
              />
              <StatTile
                label="Balance"
                value={peso(d.balance)}
                tone={d.balance > 0 ? 'error.main' : 'success.main'}
                hint={d.balance > 0 ? 'Amount due' : d.balance < 0 ? 'Overpaid' : 'Settled'}
              />
            </Box>

            {required ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Progress toward {program.code}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {standing.unitsEarned} / {required} units · {standing.unitsRemaining} remaining
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  aria-label="Units earned"
                  sx={{ height: 8, borderRadius: 4, bgcolor: '#eef1f7', '& .MuiLinearProgress-bar': { bgcolor: GOLD, borderRadius: 4 } }}
                />
              </Box>
            ) : null}

            <Box sx={{ display: 'grid', gap: { xs: 4, md: 6 }, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Section
                title="Program"
                rows={[
                  ['Program', program ? `${program.code} · ${program.name}` : d.student.course],
                  ['Department', program?.department],
                  ['Duration', program ? `${program.years} years · ${program.totalUnits} units` : ''],
                  ['Current term', currentTerm?.name],
                ]}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Section
                  title="Standing"
                  rows={[
                    ['Year level', d.student.yearLevel],
                    ['Section', d.student.section],
                    ['Enrollment status', d.student.status],
                    ['Academic status', d.student.academicStatus],
                  ]}
                />
              </Box>
            </Box>

            {(standing.outstandingFailures.length > 0 || standing.incomplete.length > 0) && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Needs attention
                </Typography>
                {standing.outstandingFailures.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <StatusChip status="Failed" />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Not yet passed:
                    </Typography>
                    {standing.outstandingFailures.map((s) => (
                      <Chip key={s.id} size="small" variant="outlined" label={`${s.code} · ${s.title}`} />
                    ))}
                  </Box>
                )}
                {standing.incomplete.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <StatusChip status="Incomplete" />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Requirements pending:
                    </Typography>
                    {standing.incomplete.map((s) => (
                      <Chip key={s.id} size="small" variant="outlined" label={`${s.code} · ${s.title}`} />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              The GWA weighs each numeric grade by its units. PE and NSTP earn units but are left out of the GWA; INC, DRP and W are not graded. Every attempt counts, including retakes.
            </Typography>
          </Box>
        )
      }}
    </DataState>
  )
}
