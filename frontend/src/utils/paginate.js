// Client-side paging math. `page` is clamped so deleting the last row of the last page is safe.
export function pageWindow(total, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(page, 1), pageCount)
  const start = (currentPage - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  return { pageCount, currentPage, start, end }
}
