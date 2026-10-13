// Shared table look (header row, cell text) so every table matches the mockup.
export const headCellSx = {
  bgcolor: '#eef1f7',
  color: 'primary.main',
  fontWeight: 700,
  fontSize: 11.5,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid',
  borderColor: 'divider',
}

export const bodyCellsSx = { '& td': { fontSize: 13.5, py: 1.25 } }

export const cardSx = { border: '1px solid', borderColor: 'divider', overflow: 'hidden' }

export const filterRowSx = { p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }
