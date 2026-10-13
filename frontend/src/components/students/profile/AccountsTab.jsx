import { useState } from 'react'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import AddOutlined from '@mui/icons-material/AddOutlined'
import BlockOutlined from '@mui/icons-material/BlockOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import api from '../../../api/axios'
import ConfirmDialog from '../../ConfirmDialog'
import IconAction from '../../IconAction'
import { useApiData } from '../../../hooks/useApiData'
import { useApiList } from '../../../hooks/useApiList'
import { apiError, formatDay, peso } from '../../../utils/records'
import StatusChip from '../StatusChip'
import { ChargeDialog, HoldDialog, PaymentDialog } from '../records/AccountDialogs'
import { DataState, EmptyNote, SectionHeader, StatTile } from '../records/RecordsParts'
import { cellSx, recordHeadSx, tableWrapSx, tileGridSx } from '../records/recordStyles'

export default function AccountsTab({ student, readOnly, notify }) {
  const state = useApiData(`/students/${student.id}/finance`)
  const terms = useApiList('/terms')
  const [dialog, setDialog] = useState(null) // 'charge' | 'payment' | 'hold'
  const [confirm, setConfirm] = useState(null) // { kind: 'charge' | 'payment' | 'hold', item }
  const [busy, setBusy] = useState(false)

  const done = (message) => {
    setDialog(null)
    notify({ severity: 'success', message })
    state.reload()
  }

  const runConfirmed = async () => {
    const { kind, item } = confirm
    setBusy(true)
    try {
      if (kind === 'hold') await api.post(`/holds/${item.id}/clear`)
      else await api.delete(`/${kind === 'charge' ? 'charges' : 'payments'}/${item.id}`)
      notify({ severity: 'success', message: kind === 'hold' ? `${item.type} hold cleared.` : `${kind === 'charge' ? 'Charge' : 'Payment'} removed.` })
      state.reload()
    } catch (err) {
      notify({ severity: 'error', message: apiError(err, 'Could not complete that action.') })
    } finally {
      setConfirm(null)
      setBusy(false)
    }
  }

  const termsReady = !terms.firstLoad
  const confirmText = {
    charge: ['Remove this charge?', 'Removing a charge lowers the balance. Use this only for entries made by mistake.', 'Remove charge'],
    payment: ['Remove this payment?', 'Removing a payment raises the balance. Use this only for entries made by mistake.', 'Remove payment'],
    hold: ['Clear this hold?', 'The student will no longer be blocked by it. The hold stays in the history as Cleared.', 'Clear hold'],
  }[confirm?.kind ?? 'charge']

  return (
    <Box>
      <DataState state={state}>
        {({ balance, totalCharges, totalPayments, charges, payments, holds }) => {
          const activeTypes = holds.filter((h) => h.status === 'Active').map((h) => h.type)
          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box sx={tileGridSx}>
                <StatTile label="Total charges" value={peso(totalCharges)} />
                <StatTile label="Total payments" value={peso(totalPayments)} />
                <StatTile label="Balance" value={peso(balance)} tone={balance > 0 ? 'error.main' : 'success.main'} hint={balance > 0 ? 'Amount due' : balance < 0 ? 'Overpaid' : 'Settled'} />
                <StatTile label="Active holds" value={activeTypes.length} tone={activeTypes.length ? '#c76a05' : 'success.main'} hint={activeTypes.join(', ') || 'Cleared'} />
              </Box>

              <Box>
                <SectionHeader
                  title="Holds"
                  subtitle="Registration or records holds placed by an office."
                  action={
                    <Button variant="outlined" startIcon={<BlockOutlined />} onClick={() => setDialog('hold')} disabled={readOnly}>
                      Place hold
                    </Button>
                  }
                />
                {holds.length === 0 ? (
                  <EmptyNote>No holds have ever been placed on this account.</EmptyNote>
                ) : (
                  <Box sx={tableWrapSx}>
                    <Table size="small" sx={{ minWidth: 620 }}>
                      <TableHead sx={recordHeadSx}>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Reason</TableCell>
                          <TableCell>Placed</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right" sx={{ width: 64 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={cellSx}>
                        {holds.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell sx={{ fontWeight: 600 }}>{h.type}</TableCell>
                            <TableCell>{h.reason}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(h.placedAt)}</TableCell>
                            <TableCell>
                              <StatusChip status={h.status} />
                              {h.clearedAt && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  {formatDay(h.clearedAt)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {h.status === 'Active' && !readOnly && (
                                <IconAction label={`Clear ${h.type} hold`} color="#1b8a47" onClick={() => setConfirm({ kind: 'hold', item: h })}>
                                  <CheckCircleOutlined sx={{ fontSize: 18 }} />
                                </IconAction>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>

              <Box>
                <SectionHeader
                  title="Charges"
                  action={
                    <Button variant="contained" color="secondary" startIcon={<AddOutlined />} onClick={() => setDialog('charge')} disabled={readOnly || !termsReady}>
                      Add charge
                    </Button>
                  }
                />
                {charges.length === 0 ? (
                  <EmptyNote>No charges yet.</EmptyNote>
                ) : (
                  <Box sx={tableWrapSx}>
                    <Table size="small" sx={{ minWidth: 640 }}>
                      <TableHead sx={recordHeadSx}>
                        <TableRow>
                          <TableCell>Due</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right" sx={{ width: 64 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={cellSx}>
                        {charges.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.dueDate ? formatDay(c.dueDate) : '-'}</TableCell>
                            <TableCell>{c.category}</TableCell>
                            <TableCell>{c.description}</TableCell>
                            <TableCell>{c.term?.name ?? '-'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {peso(c.amount)}
                            </TableCell>
                            <TableCell align="right">
                              {!readOnly && (
                                <IconAction label={`Remove charge ${c.description}`} color="#c62828" onClick={() => setConfirm({ kind: 'charge', item: c })}>
                                  <DeleteOutlined sx={{ fontSize: 18 }} />
                                </IconAction>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>

              <Box>
                <SectionHeader
                  title="Payments"
                  action={
                    <Button variant="contained" color="secondary" startIcon={<AddOutlined />} onClick={() => setDialog('payment')} disabled={readOnly || !termsReady}>
                      Record payment
                    </Button>
                  }
                />
                {payments.length === 0 ? (
                  <EmptyNote>No payments yet.</EmptyNote>
                ) : (
                  <Box sx={tableWrapSx}>
                    <Table size="small" sx={{ minWidth: 640 }}>
                      <TableHead sx={recordHeadSx}>
                        <TableRow>
                          <TableCell>Paid</TableCell>
                          <TableCell>Receipt</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Term</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right" sx={{ width: 64 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={cellSx}>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(p.paidAt)}</TableCell>
                            <TableCell>{p.receiptNo || '-'}</TableCell>
                            <TableCell>
                              {p.method}
                              {p.note && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                  {p.note}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{p.term?.name ?? '-'}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {peso(p.amount)}
                            </TableCell>
                            <TableCell align="right">
                              {!readOnly && (
                                <IconAction label={`Remove payment ${p.receiptNo || formatDay(p.paidAt)}`} color="#c62828" onClick={() => setConfirm({ kind: 'payment', item: p })}>
                                  <DeleteOutlined sx={{ fontSize: 18 }} />
                                </IconAction>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Box>

              {dialog === 'hold' && <HoldDialog student={student} activeTypes={activeTypes} onClose={() => setDialog(null)} onSaved={done} />}
            </Box>
          )
        }}
      </DataState>

      {dialog === 'charge' && <ChargeDialog student={student} terms={terms.rows} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === 'payment' && <PaymentDialog student={student} terms={terms.rows} onClose={() => setDialog(null)} onSaved={done} />}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirmText[0]}
        message={confirmText[1]}
        confirmLabel={confirmText[2]}
        confirmColor={confirm?.kind === 'hold' ? 'primary' : 'error'}
        busyLabel="Working…"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirmed}
      />
    </Box>
  )
}
