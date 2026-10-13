const VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 focus-visible:outline-navy-900',
  gold: 'bg-gold-500 text-navy-950 hover:bg-gold-400 focus-visible:outline-gold-500', // navy text: white on gold is only ~3:1
  outline: 'border border-navy-900 text-navy-900 hover:bg-navy-50 focus-visible:outline-navy-900',
  light: 'border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white', // on a navy background
  link: 'text-navy-900 underline-offset-4 hover:underline focus-visible:outline-navy-900 !px-1 !py-1',
}

function Spinner() {
  return (
    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}
