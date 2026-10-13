const TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-navy-100 bg-navy-50 text-navy-900',
  success: 'border-green-200 bg-green-50 text-green-800',
}

export default function Alert({ tone = 'info', children, className = '' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded border px-3 py-2.5 text-sm ${TONES[tone]} ${className}`}>
      {children}
    </div>
  )
}
