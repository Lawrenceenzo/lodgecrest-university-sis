import { Box, MenuItem, TextField } from '@mui/material'
import FormField from './students/FormField'

// Label-above-input controls shared by the dialogs and forms. `error` is the message to show.

export function FormInput({ name, label, required, error, ...rest }) {
  return (
    <FormField id={name} label={label} required={required} error={error}>
      <TextField id={name} name={name} size="small" fullWidth error={Boolean(error)} {...rest} />
    </FormField>
  )
}

// options: [{ value, label }]
export function FormSelect({ name, label, required, error, options, placeholder, ...rest }) {
  const text = placeholder ?? `Select ${label.toLowerCase()}`
  return (
    <FormField id={name} label={label} required={required} error={error}>
      <TextField
        id={name}
        name={name}
        size="small"
        fullWidth
        select
        error={Boolean(error)}
        slotProps={{
          select: {
            displayEmpty: true,
            renderValue: (v) =>
              options.find((o) => o.value === v)?.label ?? (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {text}
                </Box>
              ),
          },
        }}
        {...rest}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    </FormField>
  )
}
