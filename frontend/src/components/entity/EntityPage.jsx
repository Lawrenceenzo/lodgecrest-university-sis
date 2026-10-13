import { useState } from 'react'
import { Alert, Box, Button, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import api from '../../api/axios'
import PageHeader from '../PageHeader'
import TablePager from '../TablePager'
import ToastSnackbar from '../ToastSnackbar'
import ConfirmDialog from '../ConfirmDialog'
import IconAction from '../IconAction'
import { SearchField } from '../FilterControls'
import { bodyCellsSx, cardSx, filterRowSx, headCellSx } from '../tableStyles'
import { useApiList } from '../../hooks/useApiList'
import { pageWindow } from '../../utils/paginate'
import { NAVY } from '../../theme'
import EntityFormDialog from './EntityFormDialog'

const PAGE_SIZE = 5

// A searchable, paged table backed by the API: it reads the list from the server every time the page
// opens, and Add / Edit / Delete are real requests, so nothing exists only in the browser.
//   path:      the collection endpoint, e.g. '/courses'
//   columns:   [{ key, label, render?(row), nowrap? }]
//   fields:    form config (see utils/entityForm.js), or (rows) => config when the options depend on data
//   toPayload: (values) => request body        toValues: (row) => the values to show when editing
//   lockedOnEdit: field names that cannot be changed once created (shown disabled)
//   decorate:  (row) => row with extra display-only keys (used by the table and its search)
export default function EntityPage({
  title, subtitle, addLabel, noun, searchPlaceholder, path, columns, fields, toPayload = (v) => v, toValues = (r) => r,
  lockedOnEdit = [], decorate, canEdit = true, canDelete = true, addDisabled = false, itemName = (r) => r.name ?? r.title ?? r.code,
}) {
  const { rows: fetched, error, loading, firstLoad, reload } = useApiList(path)
  const rows = decorate ? fetched.map(decorate) : fetched
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null) // { row? } while the add / edit dialog is open
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [lastAddedId, setLastAddedId] = useState(null)
  const [toast, setToast] = useState(null)

  const formFields = typeof fields === 'function' ? fields(rows) : fields
  const term = search.trim().toLowerCase()
  const filtered = term ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(term))) : rows

  // After adding, show the page that holds the new row (derived, so no extra effect is needed).
  const addedIndex = lastAddedId ? filtered.findIndex((r) => r.id === lastAddedId) : -1
  const currentPage = addedIndex >= 0 ? Math.floor(addedIndex / PAGE_SIZE) + 1 : page
  const { start, end } = pageWindow(filtered.length, currentPage, PAGE_SIZE)
  const visible = filtered.slice(start, end)
  const changePage = (p) => {
    setLastAddedId(null)
    setPage(p)
  }

  const save = async (values) => {
    const editing = Boolean(dialog.row)
    const { data } = editing ? await api.put(`${path}/${dialog.row.id}`, toPayload(values)) : await api.post(path, toPayload(values))
    setDialog(null)
    if (!editing) {
      setSearch('')
      setLastAddedId(data.id)
    }
    reload()
    setToast({ severity: 'success', message: `${noun} ${editing ? 'updated' : 'added'}.` })
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await api.delete(`${path}/${toDelete.id}`)
      setToast({ severity: 'success', message: `${noun} deleted.` })
      reload()
    } catch (err) {
      setToast({ severity: 'error', message: err.response?.data?.message || `Could not delete the ${noun.toLowerCase()}.` })
    } finally {
      setToDelete(null)
      setDeleting(false)
    }
  }

  const showActions = canEdit || canDelete
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        eyebrow="Catalog"
        title={title}
        subtitle={subtitle}
        action={
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setDialog({})} disabled={addDisabled || Boolean(error)}>
            {addLabel}
          </Button>
        }
      />

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={cardSx}>
        <Box sx={filterRowSx}>
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v)
              changePage(1)
            }}
            placeholder={searchPlaceholder}
          />
        </Box>
        {loading && !firstLoad && <LinearProgress />}

        <TableContainer>
          <Table sx={{ minWidth: 620 }}>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={headCellSx}>
                    {c.label}
                  </TableCell>
                ))}
                {showActions && (
                  <TableCell sx={headCellSx} align="center">
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody sx={bodyCellsSx}>
              {firstLoad && !error && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1}>
                    <LinearProgress sx={{ my: 4 }} aria-label="Loading" />
                  </TableCell>
                </TableRow>
              )}
              {!firstLoad && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1}>
                    <Typography sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                      {rows.length === 0 && !error ? `No ${title.toLowerCase()} yet. Use “${addLabel}” to create the first one.` : 'No results found.'}
                    </Typography>
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
                  {showActions && (
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'inline-flex', gap: 0.75 }}>
                        {canEdit && (
                          <IconAction label={`Edit ${itemName(r)}`} color={NAVY} onClick={() => setDialog({ row: r })}>
                            <EditOutlined sx={{ fontSize: 18 }} />
                          </IconAction>
                        )}
                        {canDelete && (
                          <IconAction label={`Delete ${itemName(r)}`} color="#c62828" onClick={() => setToDelete(r)}>
                            <DeleteOutlined sx={{ fontSize: 18 }} />
                          </IconAction>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePager total={filtered.length} page={currentPage} pageSize={PAGE_SIZE} onChange={changePage} />
      </Paper>

      {dialog && (
        <EntityFormDialog
          key={dialog.row?.id ?? 'new'}
          title={dialog.row ? `Edit ${noun}` : addLabel}
          submitLabel={dialog.row ? 'Save changes' : `Save ${noun}`}
          fields={formFields}
          editing={Boolean(dialog.row)}
          initialValues={dialog.row ? toValues(dialog.row) : undefined}
          lockedFields={lockedOnEdit}
          onClose={() => setDialog(null)}
          onSubmit={save}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete this ${noun.toLowerCase()}?`}
        message={toDelete ? `${itemName(toDelete)} will be removed from the catalog. This cannot be undone.` : ''}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
      />
      <ToastSnackbar toast={toast} onClose={() => setToast(null)} />
    </Box>
  )
}
