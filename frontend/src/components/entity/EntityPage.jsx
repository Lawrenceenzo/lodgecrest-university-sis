import { useState } from 'react'
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import PageHeader from '../PageHeader'
import TablePager from '../TablePager'
import ToastSnackbar from '../ToastSnackbar'
import { SearchField } from '../FilterControls'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../tableStyles'
import { pageWindow } from '../../utils/paginate'
import EntityFormDialog from './EntityFormDialog'

const PAGE_SIZE = 5

// A searchable, paged table with an "Add" dialog, backed by hardcoded sample rows held in
// React state (additions last until the page is reloaded).
//   columns:  [{ key, label, render?(row), nowrap? }]
//   fields:   form config for the Add dialog (see utils/entityForm.js)
//   makeRow:  (values, rows) => the full row to append
export default function EntityPage({ title, subtitle, addLabel, searchPlaceholder, columns, fields, initialRows, makeRow, noun }) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const term = search.trim().toLowerCase()
  const filtered = term
    ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(term)))
    : rows
  const { start, end } = pageWindow(filtered.length, page, PAGE_SIZE)
  const visible = filtered.slice(start, end)

  const handleAdd = (values) => {
    setRows((prev) => [...prev, makeRow(values, prev)])
    setDialogOpen(false)
    setSearch('')
    setPage(Math.ceil((rows.length + 1) / PAGE_SIZE)) // jump to the page holding the new row
    setToast({ severity: 'success', message: `${noun} added.` })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Catalog"
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            {addLabel}
          </Button>
        }
      />

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
          />
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 620 }}>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={headCellSx}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No results found.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {visible.map((r) => (
                <TableRow key={r.id} hover>
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={c.nowrap ? { whiteSpace: 'nowrap' } : undefined}>
                      {c.render ? c.render(r) : r[c.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePager total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Paper>

      {dialogOpen && (
        <EntityFormDialog
          title={addLabel}
          submitLabel={`Save ${noun}`}
          fields={fields}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleAdd}
        />
      )}
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
