import { IconButton } from '@mui/material'

// Square, tinted icon button used in table action columns.
export default function IconAction({ label, color, onClick, children }) {
  return (
    <IconButton
      aria-label={label}
      title={label}
      onClick={onClick}
      sx={{
        width: 30,
        height: 30,
        borderRadius: 1,
        color,
        bgcolor: `${color}14`,
        '&:hover': { bgcolor: `${color}26` },
      }}
    >
      {children}
    </IconButton>
  )
}
