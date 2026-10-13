import { useEffect, useRef, useState } from 'react'
import { assetUrl } from '../api/axios'

export const PHOTO_TYPES = ['image/jpeg', 'image/png']
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024 // 2 MB, same limit the server enforces

// State for a form's photo field: the newly chosen file, a preview of it, and whether the
// existing (already uploaded) photo has been removed.
export function usePhoto(existingPath = '') {
  const [chosen, setChosen] = useState({ file: null, url: '' })
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState('')
  const urlRef = useRef('') // the live object URL, so it can be released

  const release = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ''
  }
  useEffect(() => release, []) // release on unmount

  // Checked here for instant feedback; the server checks again.
  const pick = (file) => {
    if (!PHOTO_TYPES.includes(file.type)) return setError('Choose a JPG or PNG image.')
    if (file.size > PHOTO_MAX_BYTES) return setError('The photo must be 2 MB or smaller.')
    release()
    urlRef.current = URL.createObjectURL(file)
    setChosen({ file, url: urlRef.current })
    setRemoved(false)
    return setError('')
  }

  const remove = () => {
    release()
    setChosen({ file: null, url: '' })
    setRemoved(Boolean(existingPath)) // only needs telling the server if there was a saved photo
    setError('')
  }

  return {
    file: chosen.file,
    shownUrl: chosen.url || (removed ? '' : assetUrl(existingPath)),
    removePhoto: removed && !chosen.file,
    error,
    pick,
    remove,
  }
}
