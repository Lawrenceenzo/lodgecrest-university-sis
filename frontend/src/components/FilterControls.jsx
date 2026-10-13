import { InputAdornment, MenuItem, Select, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

// Controlled search box + "All X" dropdown used above real data tables.

export function SearchField({ value, onChange, placeholder }) {
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

export function FilterSelect({ value, onChange, label, options, optionLabel = (o) => o }) {
  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 150, fontSize: 13, bgcolor: '#fff' }}
      inputProps={{ 'aria-label': label }}
    >
      <MenuItem value="">{`All ${label}`}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {optionLabel(o)}
        </MenuItem>
      ))}
    </Select>
  )
}
