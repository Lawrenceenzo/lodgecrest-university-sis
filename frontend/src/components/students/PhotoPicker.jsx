import { useRef } from 'react'
import { Avatar, Box, Button, Typography } from '@mui/material'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined'
import { PHOTO_TYPES } from '../../hooks/usePhoto'

// Round preview + "Upload Photo" button that opens a hidden file input. `photo` comes from usePhoto().
export default function PhotoPicker({ photo, disabled }) {
  const inputRef = useRef(null)
  const hasPhoto = Boolean(photo.shownUrl)

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be picked again after removing it
    if (file) photo.pick(file)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3 }}>
      <Avatar
        src={photo.shownUrl || undefined}
        alt={hasPhoto ? 'Student photo preview' : ''}
        sx={{ width: 80, height: 80, bgcolor: '#e4e8f1', color: '#9aa3b8' }}
      >
        <PersonOutlined sx={{ fontSize: 48 }} />
      </Avatar>

      <Box>
        <input
          ref={inputRef}
          id="photo"
          type="file"
          accept={PHOTO_TYPES.join(',')}
          hidden
          onChange={handleChange}
          aria-label="Student photo"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<FileUploadOutlined />}
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {hasPhoto ? 'Change Photo' : 'Upload Photo'}
          </Button>
          {hasPhoto && (
            <Button size="small" color="error" disabled={disabled} onClick={photo.remove}>
              Remove
            </Button>
          )}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75 }}>
          JPG or PNG (Max 2MB)
        </Typography>
        {photo.error && (
          <Typography variant="caption" role="alert" sx={{ display: 'block', color: 'error.main', mt: 0.5 }}>
            {photo.error}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
