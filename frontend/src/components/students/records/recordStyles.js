import { headCellSx } from '../../tableStyles'

// Shared look for the record tables and figure grids.
export const tileGridSx = { display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }
export const tableWrapSx = { border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflowX: 'auto' }
export const recordHeadSx = { '& th': headCellSx }
export const cellSx = { '& td': { fontSize: 13.5, py: 1.1, verticalAlign: 'top' } }
