import { useState } from 'react'
import { Box, InputAdornment, MenuItem, Pagination, Select, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

// Controls for the presentation pages. They keep their own local state so they feel
// alive, but they don't filter anything (the page data is hardcoded).

export function StaticSelect({ options, ariaLabel, minWidth = 150 }) {
  const [value, setValue] = useState(options[0].value)
  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(e) => setValue(e.target.value)}
      sx={{ minWidth, fontSize: 13, bgcolor: '#fff' }}
      inputProps={{ 'aria-label': ariaLabel }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  )
}

export function StaticSearch({ placeholder }) {
  const [value, setValue] = useState('')
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      sx={{ flex: '1 1 240px', maxWidth: 360, '& .MuiInputBase-root': { fontSize: 13, bgcolor: '#fff' } }}
      slotProps={{
        htmlInput: { 'aria-label': placeholder },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}

// "Showing 1-4 of 1,523" + page numbers like the mockup (1 2 3 4 5 ...).
export function StaticTableFooter({ label, pages = 20 }) {
  const [page, setPage] = useState(1)
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
        {label}
      </Typography>
      <Pagination
        count={pages}
        page={page}
        onChange={(_, p) => setPage(p)}
        color="primary"
        shape="rounded"
        size="small"
      />
    </Box>
  )
}
