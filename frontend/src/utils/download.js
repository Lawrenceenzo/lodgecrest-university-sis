import api from '../api/axios'

// Fetch a file from the API (the login token is added by the axios instance) and hand it to the browser as a download.
export async function downloadFile(path, fallbackName) {
  const res = await api.get(path, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] || ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
