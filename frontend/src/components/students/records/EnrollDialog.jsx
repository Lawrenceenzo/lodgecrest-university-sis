import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Skeleton, TextField, Typography } from '@mui/material'
import api from '../../../api/axios'
import { FormSelect } from '../../FormControls'
import FormField from '../FormField'
import { useApiList } from '../../../hooks/useApiList'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { apiError, formatMeetings } from '../../../utils/records'
import { GOLD, NAVY } from '../../../theme'
import { fullName } from '../../../utils/students'

// Pick a class offered in a term and enroll the student in it. The server enforces every rule
// (seats, schedule clashes, duplicates, prerequisites); a prerequisite refusal can be overridden here.
export default function EnrollDialog({ student, onClose, onEnrolled }) {
  const terms = useApiList('/terms')
  const [termId, setTermId] = useState('') // '' = the current term
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const offerings = useApiList('/offerings', { term: termId, search: debounced })
  const [selected, setSelected] = useState(null)
  const [override, setOverride] = useState(false)
  const [needsOverride, setNeedsOverride] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentTerm = terms.rows.find((t) => t.isCurrent)
  const termOptions = terms.rows.map((t) => ({ value: t.id, label: t.name + (t.isCurrent ? ' (current)' : '') }))

  const pick = (o) => {
    setSelected(o)
    setError('')
    setNeedsOverride(false)
    setOverride(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post(`/students/${student.id}/enrollments`, { offeringId: selected.id, skipPrerequisites: override })
      onEnrolled(selected.subject.code)
    } catch (err) {
      setError(apiError(err, 'Could not enroll the student.'))
      setNeedsOverride(err.response?.data?.code === 'PREREQUISITE_NOT_MET')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Enroll in a class</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {fullName(student)} · {student.studentId}
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 2 }}>
          <FormSelect
            name="term"
            label="Term"
            value={termId || currentTerm?.id || ''}
            onChange={(e) => {
              setTermId(e.target.value)
              pick(null)
            }}
            options={termOptions}
            disabled={terms.firstLoad}
          />
          <FormField id="offering-search" label="Search subject">
            <TextField id="offering-search" size="small" fullWidth placeholder="Code or title, e.g. IT201" value={search} onChange={(e) => setSearch(e.target.value)} />
          </FormField>
        </Box>

        <Box
          role="radiogroup"
          aria-label="Classes offered"
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, maxHeight: 300, overflowY: 'auto' }}
        >
          {offerings.firstLoad ? (
            <Skeleton variant="rectangular" height={120} />
          ) : offerings.error ? (
            <Alert severity="error">{offerings.error}</Alert>
          ) : offerings.rows.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 3, textAlign: 'center' }}>
              No classes match.
            </Typography>
          ) : (
            offerings.rows.map((o) => {
              const unavailable = o.status !== 'Open' || o.seatsLeft === 0
              const isSelected = selected?.id === o.id
              return (
                <Box
                  key={o.id}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={unavailable}
                  tabIndex={unavailable ? -1 : 0}
                  onClick={() => !unavailable && pick(o)}
                  onKeyDown={(e) => {
                    if (!unavailable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      pick(o)
                    }
                  }}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '3px solid',
                    borderLeftColor: isSelected ? GOLD : 'transparent',
                    bgcolor: isSelected ? '#f4ecdb' : 'transparent',
                    cursor: unavailable ? 'not-allowed' : 'pointer',
                    opacity: unavailable ? 0.55 : 1,
                    '&:last-child': { borderBottom: 0 },
                    '&:hover': { bgcolor: unavailable ? undefined : isSelected ? '#f4ecdb' : '#f5f6fa' },
                    '&:focus-visible': { outline: `2px solid ${NAVY}`, outlineOffset: -2 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {o.subject.code} · {o.subject.title} <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>(Sec {o.section})</Box>
                    </Typography>
                    <Typography variant="caption" sx={{ color: unavailable ? 'error.main' : 'text.secondary', fontWeight: 600 }}>
                      {o.status !== 'Open' ? o.status : o.seatsLeft === 0 ? 'Full' : `${o.seatsLeft} seats left`} · {o.subject.units} units
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatMeetings(o.meetings)} · {o.professor}
                  </Typography>
                </Box>
              )
            })
          )}
        </Box>

        {error && (
          <Alert severity={needsOverride ? 'warning' : 'error'} sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {needsOverride && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Checkbox size="small" checked={override} onChange={(e) => setOverride(e.target.checked)} />}
            label={<Typography variant="body2">Enroll anyway (admin override of the prerequisite)</Typography>}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || !selected || (needsOverride && !override)}>
          {saving ? 'Enrolling…' : 'Enroll'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
