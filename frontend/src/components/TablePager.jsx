import { Box, Pagination, Typography } from '@mui/material'
import { pageWindow } from '../utils/paginate'

// "Showing 1-5 of 8" + MUI Pagination, used under every real data table.
export default function TablePager({ total, page, pageSize, onChange }) {
  const { pageCount, currentPage, start, end } = pageWindow(total, page, pageSize)
  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {total === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}-${end} of ${total.toLocaleString()}`}
      </Typography>
      <Pagination
        count={pageCount}
        page={currentPage}
        onChange={(_, p) => onChange(p)}
        color="primary"
        shape="rounded"
        size="small"
        showFirstButton
        showLastButton
      />
    </Box>
  )
}
